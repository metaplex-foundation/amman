#!/usr/bin/env node

import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import {
  handleRelayCommand,
  handleValidatorCommand,
  ValidatorCommandArgs,
  validatorHelp,
} from './commands'
import { execSync as exec } from 'child_process'
import { AMMAN_RELAY_PORT } from '../relay'
import { killRunningServer } from '../relay/server.kill'
import { logInfo } from '../utils'

const commands = yargs(hideBin(process.argv))
  .command('validator [config]', 'Launches a solana-test-validator', (args) => {
    return args
      .positional('config', {
        describe: 'File containing config with `validator` property.',
      })
      .help('help', validatorHelp())
  })
  .command(
    'relay',
    'Launches a server that relays messages to the amman-explorer',
    (args) => {
      return args.option('ignoreRunning', {
        alias: 'i',
        desc: 'If provided does not kill a relay that is already running on the relay port',
        type: 'boolean',
        default: false,
        demandOption: false,
      })
    }
  )
  .command(
    'stop',
    'Stops the relay and kills the runnint solana test validator'
  )

async function main() {
  const args = commands.parseSync()

  if (args._.length === 0) {
    commands.showHelp()
  } else if (args._[0] === 'validator') {
    const { needHelp } = await handleValidatorCommand(
      args as ValidatorCommandArgs
    )
    if (needHelp) {
      commands.showHelp()
    }
  } else if (args._[0] === 'relay') {
    handleRelayCommand({}, new Map(), args.ignoreRunning)
  } else if (args._[0] === 'stop') {
    await killRunningServer(AMMAN_RELAY_PORT)

    try {
      exec('pkill -f solana-test-validator')
      logInfo('Killed currently running solana-test-validator')
    } catch (err) {}
  } else {
    commands.showHelp()
  }
}

main().catch((err: any) => {
  console.error(err)
  process.exit(1)
})
