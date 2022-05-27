import {
  LOCALHOST,
  AMMAN_STORAGE_PORT,
} from '@metaplex-foundation/amman-client'
import { execSync as exec, spawn } from 'child_process'
import http from 'http'
import { mapPersistedAccountInfos } from '../assets'
import { DEFAULT_ASSETS_FOLDER, SnapshotConfig } from '../assets/types'
import { Relay } from '../relay/server'
import { DEFAULT_RELAY_CONFIG, RelayConfig } from '../relay/types'
import {
  DEFAULT_STORAGE_CONFIG,
  MockStorageServer,
  StorageConfig,
} from '../storage'
import { logError, logInfo, logTrace, sleep, tmpLedgerDir } from '../utils'
import { canAccessSync } from '../utils/fs'
import { killRunningServer, resolveServerAddress } from '../utils/http'
import { ensureValidatorIsUp } from './ensure-validator-up'
import { solanaConfig } from './prepare-config'
import { processAccounts } from './process-accounts'
import { processSnapshot } from './process-snapshot'
import { ValidatorConfig } from './types'

/**
 * @private
 */
export const DEFAULT_VALIDATOR_CONFIG: ValidatorConfig = {
  killRunningValidators: true,
  programs: [],
  accountsCluster: 'https://metaplex.devnet.rpcpool.com',
  accounts: [],
  jsonRpcUrl: LOCALHOST,
  websocketUrl: '',
  commitment: 'confirmed',
  ledgerDir: tmpLedgerDir(),
  resetLedger: true,
  limitLedgerSize: 1e4,
  verifyFees: false,
  detached: process.env.CI != null,
}

/**
 * @private
 */
export async function initValidator(
  validatorConfig: Partial<ValidatorConfig>,
  relayConfig: Partial<RelayConfig> = {},
  snapshotConfig: SnapshotConfig,
  storageConfig?: StorageConfig,
  assetsFolder: string = DEFAULT_ASSETS_FOLDER,
  forceClone?: boolean
) {
  const {
    killRunningValidators,
    programs,
    accountsCluster,
    accounts,
    jsonRpcUrl,
    websocketUrl,
    commitment,
    ledgerDir,
    resetLedger,
    limitLedgerSize,
    verifyFees,
    detached,
  }: ValidatorConfig = { ...DEFAULT_VALIDATOR_CONFIG, ...validatorConfig }
  const {
    killRunningRelay,
    accountProviders,
    accountRenderers,
    enabled: relayEnabled,
  }: RelayConfig = {
    ...DEFAULT_RELAY_CONFIG,
    ...relayConfig,
  }

  // -----------------
  // Kill running validators
  // -----------------
  if (killRunningValidators) {
    try {
      exec('pkill -f solana-test-validator')
      logInfo('Killed currently running solana-test-validator')
      await sleep(1000)
    } catch (err) {}
  }

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
  } = await processSnapshot(snapshotConfig)
  args = [...args, ...snapshotArgs]

  // -----------------
  // Launch Validator
  // -----------------
  const cmd = `solana-test-validator ${args.join(' \\\n  ')}`
  if (logTrace.enabled) {
    logTrace('Launching validator with the following command')
    console.log(cmd)
  }

  const child = spawn('solana-test-validator', args, {
    detached,
    stdio: 'inherit',
  })
  child.unref()
  await new Promise((resolve, reject) => {
    child.on('spawn', resolve).on('error', reject)
  })

  logInfo(
    'Spawning new solana-test-validator with programs predeployed and ledger at %s',
    ledgerDir
  )

  // -----------------
  // Launch relay server in parallel
  // -----------------
  if (relayEnabled) {
    const accountInfos = mapPersistedAccountInfos([
      ...persistedAccountInfos,
      ...persistedSnapshotAccountInfos,
    ])
    Relay.startServer(
      accountProviders,
      accountRenderers,
      programs,
      [...accounts, ...snapshotAccounts],
      accountInfos,
      keypairs,
      accountsFolder,
      snapshotConfig.snapshotFolder,
      killRunningRelay
    )
      .then(({ app }) => {
        logInfo('Successfully launched Relay at %s', resolveServerAddress(app))
      })
      .catch((err) => {
        const msg = 'Failed to launch Relay'
        logError(msg)
        logError(err)
      })
  }

  // -----------------
  // Launch Storage server in parallel as well
  // -----------------
  const storageEnabled =
    storageConfig != null &&
    { ...DEFAULT_STORAGE_CONFIG, ...storageConfig }.enabled

  if (storageEnabled) {
    killRunningServer(AMMAN_STORAGE_PORT)
      .then(() =>
        MockStorageServer.createInstance(storageConfig).then((storage) =>
          storage.start()
        )
      )
      .then((server: http.Server) => {
        logInfo(
          'Successfully launched MockStorageServer at %s',
          resolveServerAddress(server)
        )
      })
      .catch((err) => {
        const msg = 'Failed to launch MockStorageServer'
        logError(msg)
        logError(err)
      })
  }

  // -----------------
  // Wait for validator to come up and cleanup
  // -----------------
  await ensureValidatorIsUp(jsonRpcUrl, verifyFees)
  await cleanupConfig()

  logInfo('solana-test-validator is up')
}
