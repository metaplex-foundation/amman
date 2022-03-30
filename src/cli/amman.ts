#!/usr/bin/env node

import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import { strict as assert } from 'assert'
import {
  airdropHelp,
  handleAirdropCommand,
  handleLabelCommand,
  handleRelayCommand,
  handleValidatorCommand,
  labelHelp,
  ValidatorCommandArgs,
  validatorHelp,
} from './commands'
import { execSync as exec } from 'child_process'
import { AMMAN_RELAY_PORT } from '../relay'
import { assertCommitment, commitments, logError, logInfo } from '../utils'
import { killRunningServer } from '../utils/http'
import { AMMAN_STORAGE_PORT } from '../storage'

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
  .command('airdrop', 'Airdrops provided Sol to the payer', (args) =>
    args
      .positional('destination', {
        describe:
          'A base58 PublicKey string or the relative path to the Keypair file of the airdrop destination',
        type: 'string',
      })
      .positional('amount', {
        describe: 'The amount of Sol to airdrop',
        type: 'number',
        default: 1,
      })
      .option('commitment', {
        alias: 'c',
        describe: 'The commitment to use for the Airdrop transaction',
        type: 'string',
        choices: commitments,
        default: 'singleGossip',
      })
      .help('help', airdropHelp())
  )
  .command('label', 'Adds PublicKey labels to amman', (args) =>
    args.help('help', labelHelp())
  )

async function main() {
  const args = await commands.parse()
  const { _: cs } = args
  if (cs.length === 0) {
    commands.showHelp()
    return
  }
  const command = cs[0]

  switch (command) {
    case 'validator': {
      const { needHelp } = await handleValidatorCommand(
        args as ValidatorCommandArgs
      )
      if (needHelp) {
        commands.showHelp()
      }
      break
    }
    case 'relay': {
      return handleRelayCommand({}, new Map(), args.ignoreRunning)
    }
    case 'stop': {
      await killRunningServer(AMMAN_RELAY_PORT)
      await killRunningServer(AMMAN_STORAGE_PORT)

      try {
        exec('pkill -f solana-test-validator')
        logInfo('Killed currently running solana-test-validator')
      } catch (err) {}
      break
    }
    case 'airdrop': {
      const { commitment } = args
      try {
        const destination = cs[1]
        const maybeAmount = cs[2]
        const amount =
          maybeAmount == null
            ? 1
            : typeof maybeAmount === 'string'
            ? parseInt(maybeAmount)
            : maybeAmount

        assert(
          typeof destination === 'string',
          'public key string or keypair file is required'
        )

        assert(
          destination != null,
          'public key string or keypair file is required'
        )
        assertCommitment(commitment)

        await handleAirdropCommand(destination, amount, commitment)
      } catch (err) {
        logError(err)
        commands.showHelp()
      }
      // Don't wait for web3.js to close connection to make this a bit quicker
      process.nextTick(() => {
        process.exit(0)
      })
      break
    }
    case 'label':
      const labels = cs.slice(1)
      assert(labels.length > 0, 'At least one label is required')
      for (const label of labels) {
        assert(
          typeof label == 'string',
          `All labels must be of type string 'label:publicKey' and ${label} is not`
        )
      }
      await handleLabelCommand(labels as string[])
      break
    default:
      commands.showHelp()
  }
}

main().catch((err: any) => {
  console.error(err)
  process.exit(1)
})
