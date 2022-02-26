#!/usr/bin/env node

import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import {
  handleRelayCommand,
  handleValidatorCommand,
  ValidatorCommandArgs,
  validatorHelp,
} from './commands'

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
    'Launches a server that relays messages to the amman-explorer'
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
    handleRelayCommand()
  } else {
    commands.showHelp()
  }
}

main().catch((err: any) => {
  console.error(err)
  process.exit(1)
})
