import {
  LOCALHOST,
  AMMAN_STORAGE_PORT,
} from '@metaplex-foundation/amman-client'
import { execSync as exec } from 'child_process'
import http from 'http'
import { mapPersistedAccountInfos } from '../assets'
import { Relay } from '../relay/server'
import { RelayConfig } from '../relay/types'
import { MockStorageServer } from '../storage'
import { AmmanConfig } from '../types'
import { logError, logInfo, sleep, tmpLedgerDir } from '../utils'
import { killRunningServer, resolveServerAddress } from '../utils/http'
import {
  buildSolanaValidatorArgs,
  startSolanaValidator,
  waitForValidator,
} from './solana-validator'
import { AmmanState, ValidatorConfig } from './types'

/**
 * @private
 */
export const DEFAULT_VALIDATOR_CONFIG: ValidatorConfig = {
  killRunningValidators: true,
  programs: [],
  accountsCluster: 'https://api.devnet.solana.com',
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
  config: Required<AmmanConfig>,
  forceClone?: boolean
) {
  const {
    killRunningValidators,
    programs,
    accounts,
    jsonRpcUrl,
    ledgerDir,
    verifyFees,
    detached,
  }: ValidatorConfig = config.validator
  const {
    killRunningRelay,
    accountProviders,
    accountRenderers,
    enabled: relayEnabled,
  }: RelayConfig = config.relay

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
  // Launch Validator
  // -----------------
  logInfo(
    'Launching new solana-test-validator with programs predeployed and ledger at %s',
    ledgerDir
  )
  const {
    args,
    persistedAccountInfos,
    persistedSnapshotAccountInfos,
    snapshotAccounts,
    accountsFolder,
    keypairs,
    cleanupConfig,
  } = await buildSolanaValidatorArgs(config, forceClone ?? false)
  const validator = await startSolanaValidator(args, detached)
  const ammanState: AmmanState = {
    validator,
    detached,
    config,
  }

  // -----------------
  // Launch relay server in parallel
  // -----------------
  if (relayEnabled) {
    const accountInfos = mapPersistedAccountInfos([
      ...persistedAccountInfos,
      ...persistedSnapshotAccountInfos,
    ])
    Relay.startServer(
      ammanState,
      accountProviders,
      accountRenderers,
      programs,
      [...accounts, ...snapshotAccounts],
      accountInfos,
      keypairs,
      accountsFolder,
      config.snapshot.snapshotFolder,
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
  if (config.storage.enabled) {
    killRunningServer(AMMAN_STORAGE_PORT)
      .then(() =>
        MockStorageServer.createInstance(config.storage).then((storage) =>
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
  await waitForValidator(jsonRpcUrl, verifyFees, cleanupConfig)

  return ammanState
}
