import path from 'path'
import { logDebug, logError, logInfo } from '../../utils'
import { DEFAULT_VALIDATOR_CONFIG, initValidator } from '../../validator'
import { AmmanConfig } from '../../types'
import { canAccess } from '../../utils/fs'
import { DEFAULT_RELAY_CONFIG } from '../../relay/types'
import { pipeSolanaLogs } from '../utils/solana-logs'
import { cliAmmanInstance } from '../utils'

export type StartCommandArgs = {
  config?: string
}

export const DEFAULT_START_CONFIG: AmmanConfig = {
  validator: DEFAULT_VALIDATOR_CONFIG,
  relay: DEFAULT_RELAY_CONFIG,
  streamTransactionLogs: process.env.CI == null,
}

export async function handleStartCommand(args: StartCommandArgs) {
  let config: AmmanConfig, configPath
  try {
    ;({ config, configPath } = await resolveConfig(args))
    if (configPath != null) {
      logInfo('Loading config from %s', configPath)
    }
    if (config.validator == null) {
      logError(`This config ${config} is missing a 'validator' property`)
      process.exit(1)
    }
    logInfo(
      `Running validator with ${config.validator.programs.length} custom program(s) preloaded`
    )
    logDebug(config.validator)
    await initValidator(config.validator, config.relay, config.storage)

    if (config.streamTransactionLogs) {
      pipeSolanaLogs(cliAmmanInstance())
    }
    return { needHelp: false }
  } catch (err: any) {
    logError(err)
    logError(
      `Having trouble loading amman config from ${args.config} which resolved to ${configPath}`
    )
    return { needHelp: true }
  }
}

async function resolveConfig({ config }: StartCommandArgs) {
  if (config == null) {
    const { config: localConfig, configPath } = await tryLoadLocalConfigRc()
    return { config: { ...DEFAULT_START_CONFIG, ...localConfig }, configPath }
  } else {
    const configPath = path.resolve(config)
    return {
      config: { ...DEFAULT_START_CONFIG, ...require(configPath) },
      configPath,
    }
  }
}

async function tryLoadLocalConfigRc() {
  const configPath = path.join(process.cwd(), '.ammanrc.js')
  if (await canAccess(configPath)) {
    const config = require(configPath)
    logDebug(
      'Found `.ammanrc.js` in current directory and using that as config'
    )
    return { config, configPath }
  } else {
    logInfo(
      'No config provided nor `.ammanrc.js` found in current directory. Launching with default config.'
    )
    return { config: DEFAULT_START_CONFIG, configPath: null }
  }
}

export function startHelp() {
  return `
amman start [<config.js>]

A config should be aJavaScript module exporting at a minimum 'validator' with any of the below properties:

If no config is provided, a local .ammanrc.js will be used, falling back to a default config if not found.

killRunningValidators: if true will kill any solana-test-validators currently running on the system.

programs: bpf programs which should be loaded into the test validator

jsonRpcUrl: the URL at which the test validator should listen for JSON RPC requests

websocketUrl: for the RPC websocket

ledgerDir: where the solana test validator writes the ledger

resetLedger: if true the ledger is reset to genesis at startup

verifyFees: if true the validator is not considered fully started up until it charges transaction fees
`
}
