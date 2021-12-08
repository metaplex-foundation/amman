#!/usr/bin/env node

import path from 'path'
import { initValidator } from '../validator'

function help() {
  return `
amman <config.js>

The config should be a JavaScript module exporting any of the below properties:

  killRunningValidators   if true will kill any solana-test-validators currently running on the system.
  programs                bpf programs which should be loaded into the test validator
  jsonRpcUrl              the URL at which the test validator should listen for JSON RPC requests
  websocketUrl            for the RPC websocket
  ledgerDir               where the solana test validator writes the ledger
  resetLedger             if true the ledger is reset to genesis at startup
  verifyFees              if true the validator is not considered fully started up until it charges transaction fees
`
}

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(help())
  process.exit(0)
}
let configPath
if (args.length === 0) {
  console.error(
    '\n  No config provided, using default config, run with `--help` for more info\n'
  )
} else {
  configPath = path.resolve(args[0])
}
try {
  const config = configPath != null ? require(configPath) : {}
  initValidator(config)
} catch (err: any) {
  console.error(
    `Having trouble loading amman config from ${args[0]} which resolved to ${configPath}`
  )
  console.error(err)
  console.log(help())
}
