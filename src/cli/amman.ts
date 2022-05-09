#!/usr/bin/env node

import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import { strict as assert } from 'assert'
import {
  airdropHelp,
  handleAccountCommand,
  handleAirdropCommand,
  handleLabelCommand,
  handleRunCommand,
  handleStartCommand,
  labelHelp,
  StartCommandArgs,
  startHelp,
  runHelp,
  handleLogsCommand,
} from './commands'
import { execSync as exec } from 'child_process'
import { AMMAN_RELAY_PORT } from '../relay'
import { assertCommitment, commitments, logError, logInfo } from '../utils'
import { killRunningServer } from '../utils/http'
import { AMMAN_STORAGE_PORT, MockStorageServer } from '../storage'
import { closeConnection } from './utils'
import { Amman } from '../api'
import { Connection } from '@solana/web3.js'

const commands = yargs(hideBin(process.argv))
  // -----------------
  // start
  // -----------------
  .command(
    'start',
    'Launches a solana-test-validator and the amman relay and/or mock storage if so configured',
    (args) => {
      return args
        .positional('config', {
          describe:
            'File containing config with `validator` property along with options for the relay and storage.',
          type: 'string',
          demandOption: false,
        })
        .option('forceClone', {
          alias: 'f',
          describe:
            'Whether or not to force updating the programs from on chain',
          type: 'boolean',
          default: false,
        })
        .help('help', startHelp())
    }
  )
  // -----------------
  // stop
  // -----------------
  .command(
    'stop',
    'Stops the relay and storage and kills the running solana test validator'
  )
  // -----------------
  // logs
  // -----------------
  .command('logs', `Launches 'solana logs' and pipes them through a prettifier`)
  // -----------------
  // airdrop
  // -----------------
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
      .option('label', {
        alias: 'l',
        describe: 'The label to give to the account being airdropped to',
        type: 'string',
        default: 'payer',
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
  // -----------------
  // label
  // -----------------
  .command(
    'label',
    'Adds labels for accounts or transactions to amman',
    (args) => args.help('help', labelHelp())
  )
  // -----------------
  // account
  // -----------------
  .command(
    'account',
    'Retrieves account information for a PublicKey or a label or shows all labeled accounts',
    (args) =>
      args
        .positional('address', {
          describe:
            'A base58 PublicKey string or the label of the acount to retrieve.' +
            ' If it is not provided, all labeled accounts are shown.',
          type: 'string',
          demandOption: false,
        })
        .option('includeTx', {
          alias: 't',
          describe:
            'If to include transactions in the shown labeled accounts when no label/address is provided',
          type: 'boolean',
          default: false,
        })
  )
  // -----------------
  // run
  // -----------------
  .command(
    'run',
    'Executes the provided command after expanding all address labels',
    (args) =>
      args
        .option('label', {
          alias: 'l',
          describe: 'Used to label addresses found int the command output ',
          type: 'string',
          multiple: true,
          demandOption: false,
        })
        .option('txOnly', {
          alias: 't',
          describe: 'Includes only transaction addresses when labeling.',
          type: 'string',
          demandOption: false,
          default: false,
        })
        .option('accOnly', {
          alias: 'a',
          describe: 'Includes only account addresses when labeling.',
          type: 'string',
          demandOption: false,
          default: false,
        })
        .help('help', runHelp())
  )

async function main() {
  setupGracefulShutdown()
  const args = await commands.parse()
  const { _: cs } = args
  if (cs.length === 0) {
    commands.showHelp()
    return
  }
  const command = cs[0]

  switch (command) {
    // -----------------
    // start
    // -----------------
    case 'start': {
      const { needHelp } = await handleStartCommand(args as StartCommandArgs)
      if (needHelp) {
        logInfo("Rerun `amman --help` for more information")
      }
      break
    }
    // -----------------
    // stop
    // -----------------
    case 'stop': {
      await stopAmman()
      break
    }
    // -----------------
    // logs
    // -----------------
    case 'logs': {
      handleLogsCommand()
      break
    }
    // -----------------
    // airdrop
    // -----------------
    case 'airdrop': {
      const { commitment, label } = args
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

        const { connection } = await handleAirdropCommand(
          destination,
          amount,
          label!,
          commitment
        )

        await closeConnection(connection, true)
      } catch (err) {
        logError(err)
        commands.showHelp()
      }
      break
    }
    // -----------------
    // label
    // -----------------
    case 'label': {
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
    }
    // -----------------
    // account
    // -----------------
    case 'account': {
      const address = cs[1]
      const { includeTx } = args
      assert(
        address == null || typeof address === 'string',
        'provided public key or label needs to be a string'
      )
      assert(
        !includeTx || address == null,
        '--includeTx can only be used when noe address is provided'
      )

      const { connection, rendered } = await handleAccountCommand(
        address,
        includeTx
      )
      console.log(rendered)
      if (connection! != null) {
        await closeConnection(connection, true)
      }
      disconnectAmman()
      break
    }
    // -----------------
    // run
    // -----------------
    case 'run': {
      let labels: string | string[] = args.label ?? []
      if (!Array.isArray(labels)) {
        labels = [labels]
      }

      const { txOnly, accOnly } = args
      const cmdArgs = cs.slice(1)
      assert(
        cmdArgs.length > 0,
        'At least one argument is required or did you mean to `amman start`?'
      )
      try {
        const { stdout, stderr } = await handleRunCommand(
          labels,
          cmdArgs,
          txOnly,
          accOnly
        )
        console.error(stderr)
        console.log(stdout)
      } catch (err: any) {
        logError(err.toString())
      }
      break
    }
    default:
      commands.showHelp()
  }
}

async function disconnectAmman(connection?: Connection) {
  try {
    Amman.existingInstance?.disconnect()
    Amman.existingInstance?.destroy()
  } catch (_) {}
  try {
    MockStorageServer.existingInstance?.stop()
  } catch (_) {}

  if (connection! != null) {
    try {
      await closeConnection(connection, true)
    } catch (_) {}
  }
}

async function stopAmman() {
  try {
    exec('pkill -f solana-test-validator')
    logInfo('Killed currently running solana-test-validator')
  } catch (_) {}

  try {
    await killRunningServer(AMMAN_RELAY_PORT)
  } catch (_) {}
  try {
    await killRunningServer(AMMAN_STORAGE_PORT)
  } catch (_) {}
}

function setupGracefulShutdown() {
  process.on('beforeExit', () => {
    disconnectAmman()
  })
}

main().catch((err: any) => {
  logError(err)
  process.exit(1)
})
