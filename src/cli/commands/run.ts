import { strict as assert } from 'assert'
import { cliAmmanInstance, resolveAccountAddresses } from '../utils'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'
import { dim } from 'ansi-colors'
import { logDebug, logError } from '../../utils'
const exec = promisify(execCb)

export const LABEL_INDICATOR = '+'

export async function handleRunCommand(
  labels: string[],
  args: (string | number)[],
  transactionsOnly: boolean,
  accountsOnly: boolean
) {
  const amman = cliAmmanInstance()
  try {
    const withLabelsExpanded = await Promise.all(
      args.map(async (arg: string | number) => {
        if (typeof arg === 'string' && arg.startsWith(LABEL_INDICATOR)) {
          const resolvedAddresses = await resolveAccountAddresses(
            amman,
            arg.slice(1)
          )
          assert(
            resolvedAddresses.length !== 0,
            `Could not resolve label ${arg}`
          )
          if (resolvedAddresses.length > 1) {
            const rendered = resolvedAddresses.map((x) => dim(x)).join('\n  ')
            throw new Error(
              `Label ${arg} resolves to multiple addresses:\n  ${rendered}` +
                `\n\nTherefore amman cannot expand it, please provide the address you want to use directly.`
            )
          }
          return resolvedAddresses
        }
        return arg
      })
    )
    const cmd = withLabelsExpanded.join(' ')
    console.log(`\n${dim(cmd)}`)

    const { stderr, stdout } = await exec(cmd)

    if (labels.length > 0) {
      try {
        logDebug(`Adding labels ${labels} from stdout`)
        await amman.addr.addLabelsFromText(labels, stdout, {
          transactionsOnly,
          accountsOnly,
        })
      } catch (err: any) {
        logError(`Failed to add labels from command output\n${err.message}`)
      }
    }

    return { stderr, stdout }
  } catch (err: any) {
    logError(err.message)
    return Promise.resolve({ stdout: '', stderr: '' })
  } finally {
    amman.disconnect()
  }
}

export function runHelp() {
  return `
  Usage:
    amman run -- <command with labels prefixed with +>

  Examples:
    amman run -- spl-token balance +token --owner +owner
    amman run -- solana balance +token
`
}
