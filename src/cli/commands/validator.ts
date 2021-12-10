import path from 'path'
import { promises as fs } from 'fs'
import { logDebug, logInfo } from '../../utils'
import { initValidator } from '../../validator'

export type ValidatorCommandArgs = {
  config?: string
}

export async function handleValidatorCommand(args: ValidatorCommandArgs) {
  let config, configPath
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
    await initValidator(config.validator)
    return { needHelp: false }
  } catch (err: any) {
    console.error(err)
    console.error(
      `Having trouble loading amman config from ${config} which resolved to ${configPath}`
    )
    return { needHelp: true }
  }
}

function resolveConfig({ config }: ValidatorCommandArgs) {
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
    console.error(
      '\n  No config provided nor an `.ammanrc.js` file found in current directory, using default config, run with `--help` for more info\n'
    )
    return { config: { validator: {} }, configPath: null }
  }
}

async function canAccess(p: string) {
  try {
    await fs.access(p)
    return true
  } catch (_) {
    return false
  }
}

export function validatorHelp() {
  return `
amman validator <config.js>

The config should be a JavaScript module exporting 'validator' with any of the below properties:

killRunningValidators: if true will kill any solana-test-validators currently running on the system.

programs: bpf programs which should be loaded into the test validator

jsonRpcUrl: the URL at which the test validator should listen for JSON RPC requests

websocketUrl: for the RPC websocket

ledgerDir: where the solana test validator writes the ledger

resetLedger: if true the ledger is reset to genesis at startup

verifyFees: if true the validator is not considered fully started up until it charges transaction fees
`
}
