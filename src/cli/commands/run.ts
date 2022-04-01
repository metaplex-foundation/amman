import { strict as assert } from 'assert'
import { cliAmmanInstance, resolveAccountAddress } from '../utils'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'
import { dim } from 'ansi-colors'
const exec = promisify(execCb)

export const LABEL_INDICATOR = '+'

export async function handleRunCommand(args: (string | number)[]) {
  const amman = cliAmmanInstance()
  const withLabelsExpanded = await Promise.all(
    args.map(async (arg: string | number) => {
      if (typeof arg === 'string' && arg.startsWith(LABEL_INDICATOR)) {
        const resolvedAddress = await resolveAccountAddress(amman, arg.slice(1))
        assert(resolvedAddress != null, `Could not resolve label ${arg}`)
        return resolvedAddress
      }
      return arg
    })
  )
  amman.disconnect()

  const cmd = withLabelsExpanded.join(' ')
  console.log(`\n${dim(cmd)}`)
  return exec(cmd)
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
