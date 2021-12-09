import path from 'path'
import { logDebug, logInfo } from '../../utils'
import { initValidator } from '../../validator'

export type ValidatorCommandArgs = {
  config?: string
}

export async function handleValidatorCommand(args: ValidatorCommandArgs) {
  let configPath

  const { config } = args
  if (config == null) {
    // TODO: try to find `.ammanrc.js` in PWD first
    console.error(
      '\n  No config provided, using default config, run with `--help` for more info\n'
    )
  } else {
    configPath = path.resolve(config)
  }
  try {
    const config = configPath != null ? require(configPath) : { validator: {} }
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
