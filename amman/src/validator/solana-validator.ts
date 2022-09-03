import { PersistedAccountInfo } from '@metaplex-foundation/amman-client'
import { Keypair } from '@solana/web3.js'
import { ChildProcess, spawn } from 'child_process'
import { AccountStates } from 'src/accounts/state'
import { createTemporarySnapshot, SnapshotConfig } from '../assets'
import { AmmanConfig } from '../types'
import { maybeDeactivateFeatures } from '../utils/deactivate-features'
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
    matchFeatures,
    deactivateFeatures,
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
  // Deactivate Features
  // -----------------
  maybeDeactivateFeatures(args, matchFeatures, deactivateFeatures)

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

export function killValidatorChild(child: ChildProcess) {
  child.kill()
  return new Promise((resolve, reject) => {
    child.on('exit', resolve).on('error', reject)
  })
}

/**
 * Attempts to kill and restart the validator creating a snapshot of accounts and keypairs first.
 * That same snapshot is then loaded on restart.
 *
 * @param accountOverrides allow to override some accounts that are written to the snapshot
 *
 */
export async function restartValidatorWithAccountOverrides(
  accountStates: AccountStates,
  ammanState: AmmanState,
  addresses: string[],
  // Keyed pubkey:label
  accountLabels: Record<string, string>,
  keypairs: Map<string, { keypair: Keypair; id: string }>,
  accountOverrides: Map<string, PersistedAccountInfo>
) {
  const { config: snapshot, cleanupSnapshotDir } =
    await createTemporarySnapshot(
      addresses,
      accountLabels,
      keypairs,
      accountOverrides
    )

  const config: Required<AmmanConfig> = { ...ammanState.config, snapshot }
  const res = await restartValidator(accountStates, ammanState, config)

  await cleanupSnapshotDir()

  return res
}

/**
 * Attempts to kill and restart the validator with the given snapshot.
 */
export async function restartValidatorWithSnapshot(
  accountStates: AccountStates,
  ammanState: AmmanState,
  snapshotLabel: string
) {
  const snapshot: SnapshotConfig = {
    ...ammanState.config.snapshot,
    load: snapshotLabel,
  }
  const config: Required<AmmanConfig> = { ...ammanState.config, snapshot }
  return restartValidator(accountStates, ammanState, config)
}

/**
 * Attempts to kill and restart the validator with the provided config.
 *
 * NOTE: that for now this seems to only work once, i.e. the validator fails to
 * handle transactions after it is restarted twice (they time out after 30secs)
 *
 */
export async function restartValidator(
  accountStates: AccountStates,
  ammanState: AmmanState,
  config: Required<AmmanConfig>
) {
  logDebug('Restarting validator')

  accountStates.paused = true

  try {
    await killValidatorChild(ammanState.validator)

    const { args, cleanupConfig, ...rest } = await buildSolanaValidatorArgs(
      config,
      false
    )
    const validator = await startSolanaValidator(args, ammanState.detached)
    ammanState.validator = validator

    await waitForValidator(
      config.validator.jsonRpcUrl,
      config.validator.verifyFees,
      cleanupConfig
    )
    return { args, ...rest }
  } finally {
    accountStates.paused = false
  }
}
