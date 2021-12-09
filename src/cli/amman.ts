#!/usr/bin/env node

import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import {
  handleValidatorCommand,
  ValidatorCommandArgs,
  validatorHelp,
} from './commands'

const commands = yargs(hideBin(process.argv)).command(
  'validator [config]',
  'Launches a solana-test-validator',
  (args) => {
    return args
      .positional('config', {
        describe: 'File containing config with `validator` property.',
      })
      .help('help', validatorHelp())
  }
)

async function main() {
  const args = commands.parseSync()

  if (args._.length === 0 || args._[0] !== 'validator') {
    commands.showHelp()
  } else {
    const { needHelp } = await handleValidatorCommand(
      args as ValidatorCommandArgs
    )
    if (needHelp) {
      commands.showHelp()
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: any) => {
    console.error(err)
    process.exit(1)
  })
