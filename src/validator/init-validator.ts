import {
  LOCALHOST,
  logError,
  logInfo,
  logTrace,
  sleep,
  tmpLedgerDir,
} from '../utils'
import { killRunningServer, resolveServerAddress } from '../utils/http'

import http from 'http'
import { execSync as exec, spawn } from 'child_process'
import { solanaConfig } from './prepare-config'
import { ensureValidatorIsUp } from './ensure-validator-up'
import { ValidatorConfig } from './types'
import { Relay } from '../relay/server'
import { DEFAULT_RELAY_CONFIG, RelayConfig } from '../relay/types'
import {
  AMMAN_STORAGE_PORT,
  DEFAULT_STORAGE_CONFIG,
  MockStorageServer,
  StorageConfig,
} from '../storage'
import {
  getExecutableAddress,
  handleFetchAccounts,
} from '../assets/local-accounts'
import { ACCOUNTS_FOLDER, DEFAULT_ASSETS_FOLDER } from '../assets/types'
import path from 'path'
import { canAccess, canAccessSync } from '../utils/fs'

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
  commitment: 'singleGossip',
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

  if (killRunningValidators) {
    try {
      exec('pkill -f solana-test-validator')
      logInfo('Killed currently running solana-test-validator')
      await sleep(1000)
    } catch (err) {}
  }

  const { configPath, cleanupConfig } = await solanaConfig({
    websocketUrl,
    jsonRpcUrl,
    commitment,
  })

  const args = ['--quiet', '-C', configPath, '--ledger', ledgerDir]
  if (resetLedger) args.push('-r')

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

  if (accounts.length > 0) {
    const accountsFolder = path.resolve(
      process.cwd(),
      path.join(assetsFolder, ACCOUNTS_FOLDER)
    )
    await handleFetchAccounts(
      accountsCluster,
      accounts,
      accountsFolder,
      forceClone
    )
    for (const { accountId, executable } of accounts) {
      args.push('--account')
      args.push(accountId)
      args.push(path.join(accountsFolder, `${accountId}.json`))

      if (executable) {
        const executableId = await getExecutableAddress(accountId)
        const executablePath = path.join(accountsFolder, `${executableId}.json`)
        if (await canAccess(executablePath)) {
          args.push('--account')
          args.push(executableId)
          args.push(executablePath)
        } else {
          logError(
            `Can't find executable account info file for executable account ${accountId}`
          )
        }
      }
    }
  }
  args.push(...['--limit-ledger-size', limitLedgerSize.toString()])

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

  // Launch relay server in parallel
  if (relayEnabled) {
    Relay.startServer(
      accountProviders,
      accountRenderers,
      programs,
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

  // Launch Storage server in parallel as well
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

  await ensureValidatorIsUp(jsonRpcUrl, verifyFees)
  await cleanupConfig()

  logInfo('solana-test-validator is up')
}
