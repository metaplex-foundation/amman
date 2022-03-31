import path from 'path'
import { logDebug, logInfo } from '../../utils'
import { initValidator } from '../../validator'
import { DEFAULT_VALIDATOR_CONFIG, initValidator } from '../../validator'
import { AmmanConfig } from '../../types'
import { canAccess } from '../../utils/fs'
import { DEFAULT_RELAY_CONFIG } from '../../relay/types'

export type StartCommandArgs = {
  config?: string
}

export const DEFAULT_START_CONFIG: AmmanConfig = {
  validator: DEFAULT_VALIDATOR_CONFIG,
  relay: DEFAULT_RELAY_CONFIG,
}

export async function handleStartCommand(args: StartCommandArgs) {
  let config: AmmanConfig, configPath
  try {
    ;({ config, configPath } = await resolveConfig(args))
    if (configPath != null) {
      logInfo('Loading config from %s', configPath)
    }
    if (config.validator == null) {
      console.error(`This config ${config} is missing a 'validator' property`)
      process.exit(1)
    }
    logInfo(
      `Running validator with ${config.validator.programs.length} custom program(s) preloaded`
    )
    logDebug(config.validator)
    await initValidator(config.validator, config.relay, config.storage)
    return { needHelp: false }
  } catch (err: any) {
    console.error(err)
    console.error(
      `Having trouble loading amman config from ${args.config} which resolved to ${configPath}`
    )
    return { needHelp: true }
  }
}

function resolveConfig({ config }: StartCommandArgs) {
  if (config == null) {
    return tryLoadLocalConfigRc()
  } else {
    const configPath = path.resolve(config)
    return { config: require(configPath), configPath }
  }
}

async function tryLoadLocalConfigRc() {
  const configPath = path.join(process.cwd(), '.ammanrc.js')
  if (await canAccess(configPath)) {
    const config = require(configPath)
    logInfo('Found `.ammanrc.js` in current directory and using that as config')
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
amman start <config.js>

At a minimum config should be a JavaScript module exporting 'validator' with any of the below properties:

killRunningValidators: if true will kill any solana-test-validators currently running on the system.

programs: bpf programs which should be loaded into the test validator

jsonRpcUrl: the URL at which the test validator should listen for JSON RPC requests

websocketUrl: for the RPC websocket

ledgerDir: where the solana test validator writes the ledger

resetLedger: if true the ledger is reset to genesis at startup

verifyFees: if true the validator is not considered fully started up until it charges transaction fees
`
}
