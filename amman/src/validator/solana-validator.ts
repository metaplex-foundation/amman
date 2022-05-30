import { PersistedAccountInfo } from '@metaplex-foundation/amman-client'
import { Keypair } from '@solana/web3.js'
import { ChildProcess, spawn } from 'child_process'
import { createTemporarySnapshot } from '../assets'
import { AmmanConfig } from '../types'
import { canAccessSync } from '../utils/fs'
import { scopedLog } from '../utils/log'
import { ensureValidatorIsUp } from './ensure-validator-up'
import { solanaConfig } from './prepare-config'
import { processAccounts } from './process-accounts'
import { processSnapshot } from './process-snapshot'
import { AmmanState } from './types'

const { logDebug, logInfo, logTrace } = scopedLog('validator')

export async function buildSolanaValidatorArgs(
  config: Required<AmmanConfig>,
  forceClone: boolean
) {
  logTrace('config %O', config)
  const validatorConfig = config.validator
  const {
    programs,
    accountsCluster,
    accounts,
    ledgerDir,
    resetLedger,
    limitLedgerSize,
    websocketUrl,
    jsonRpcUrl,
    commitment,
  } = validatorConfig

  const { assetsFolder } = config

  // -----------------
  // Setup Solana Config
  // -----------------
  const { configPath, cleanupConfig } = await solanaConfig({
    websocketUrl,
    jsonRpcUrl,
    commitment,
  })

  let args = ['--quiet', '-C', configPath, '--ledger', ledgerDir]
  if (resetLedger) args.push('-r')
  args.push(...['--limit-ledger-size', limitLedgerSize.toString()])

  // -----------------
  // Deploy Programs
  // -----------------
  if (programs.length > 0) {
    for (const { programId, deployPath } of programs) {
      if (!canAccessSync(deployPath)) {
        throw new Error(`Cannot access program deploy path of ${deployPath}`)
      }
      args.push('--bpf-program')
      args.push(programId)
      args.push(deployPath)
    }
  }

  // -----------------
  // Add Cloned Accounts
  // -----------------
  const { accountsArgs, persistedAccountInfos, accountsFolder } =
    await processAccounts(accounts, accountsCluster, assetsFolder, forceClone)
  args = [...args, ...accountsArgs]

  // -----------------
  // Add Snapshot
  // -----------------
  const {
    snapshotArgs,
    persistedSnapshotAccountInfos,
    snapshotAccounts,
    keypairs,
  } = await processSnapshot(config.snapshot)
  args = [...args, ...snapshotArgs]

  return {
    args,
    persistedAccountInfos,
    persistedSnapshotAccountInfos,
    snapshotAccounts,
    accountsFolder,
    keypairs,
    cleanupConfig,
  }
}

export async function startSolanaValidator(args: string[], detached: boolean) {
  logTrace('start %O', args)
  const child = spawn('solana-test-validator', args, {
    detached,
    stdio: 'inherit',
  })
  child.unref()
  await new Promise((resolve, reject) => {
    child.on('spawn', resolve).on('error', reject)
  })

  return child
}

export async function waitForValidator(
  jsonRpcUrl: string,
  verifyFees: boolean,
  cleanupConfig: () => Promise<void>
) {
  await ensureValidatorIsUp(jsonRpcUrl, verifyFees)
  await cleanupConfig()
  logInfo('up and running')
}

export async function killValidatorChild(child: ChildProcess) {
  child.kill()
  await new Promise((resolve, reject) => {
    child.on('exit', resolve).on('error', reject)
  })
}

export async function restartValidator(
  ammanState: AmmanState,
  addresses: string[],
  // Keyed pubkey:label
  accountLabels: Record<string, string>,
  keypairs: Map<string, { keypair: Keypair; id: string }>,
  accountOverrides: Map<string, PersistedAccountInfo> = new Map()
) {
  logDebug('Restarting validator')

  const { config: snapshot, cleanupSnapshotDir } =
    await createTemporarySnapshot(
      addresses,
      accountLabels,
      keypairs,
      accountOverrides
    )
  await killValidatorChild(ammanState.validator)

  const config: Required<AmmanConfig> = { ...ammanState.config, snapshot }
  // TODO(thlorenz): Ideally we'd update account states, etc. like we do on main startup
  const { args, cleanupConfig } = await buildSolanaValidatorArgs(config, false)
  const validator = await startSolanaValidator(args, ammanState.detached)
  ammanState.validator = validator

  await waitForValidator(
    config.validator.jsonRpcUrl,
    config.validator.verifyFees,
    cleanupConfig
  )

  await cleanupSnapshotDir()
}
