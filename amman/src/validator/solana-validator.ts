import { ChildProcess, spawn } from 'child_process'
import { AmmanConfig } from '../types'
import { canAccessSync } from '../utils/fs'
import { ensureValidatorIsUp } from './ensure-validator-up'
import { solanaConfig } from './prepare-config'
import { processAccounts } from './process-accounts'
import { processSnapshot } from './process-snapshot'

export async function buildSolanaValidatorArgs(
  config: Required<AmmanConfig>,
  forceClone: boolean
) {
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
}

export async function killValidatorChild(child: ChildProcess) {
  child.kill()
  await new Promise((resolve, reject) => {
    child.on('exit', resolve).on('error', reject)
  })
}
