// https://github.com/solana-labs/solana/blob/cd09390367d2ac66e2269a39cd40c4b3097c6732/explorer/src/utils/program-logs.ts
import { TransactionError } from '@solana/web3.js'
import { Cluster, programLabel } from './program-names'
import { getTransactionInstructionError } from './program-err'

export type LogMessage = {
  text: string
  prefix: string
  style: 'muted' | 'info' | 'success' | 'warning'
}

export type InstructionLogs = {
  logs: LogMessage[]
  failed: boolean
}

export function prettyProgramLogs(
  logs: string[],
  error: TransactionError | null,
  cluster: Cluster
): InstructionLogs[] {
  let depth = 0
  let prettyLogs: InstructionLogs[] = []
  const prefixBuilder = (depth: number) => {
    const prefix = new Array(depth - 1).fill('\u00A0\u00A0').join('')
    return prefix + '> '
  }

  let prettyError
  if (error) {
    prettyError = getTransactionInstructionError(error)
  }

  logs.forEach((log) => {
    if (log.startsWith('Program log:')) {
      prettyLogs[prettyLogs.length - 1].logs.push({
        prefix: prefixBuilder(depth),
        text: log,
        style: 'muted',
      })
    } else {
      const regex = /Program (\w*) invoke \[(\d)\]/g
      const matches = [...log.matchAll(regex)]

      if (matches.length > 0) {
        const programAddress = matches[0][1]
        const programName =
          programLabel(programAddress, cluster) ||
          `Unknown (${programAddress}) Program`

        if (depth === 0) {
          prettyLogs.push({
            logs: [],
            failed: false,
          })
        } else {
          prettyLogs[prettyLogs.length - 1].logs.push({
            prefix: prefixBuilder(depth),
            style: 'info',
            text: `Invoking ${programName}`,
          })
        }

        depth++
      } else if (log.includes('success')) {
        prettyLogs[prettyLogs.length - 1].logs.push({
          prefix: prefixBuilder(depth),
          style: 'success',
          text: `Program returned success`,
        })
        depth--
      } else if (log.includes('failed')) {
        const instructionLog = prettyLogs[prettyLogs.length - 1]
        if (!instructionLog.failed) {
          instructionLog.failed = true
          instructionLog.logs.push({
            prefix: prefixBuilder(depth),
            style: 'warning',
            text: `Program returned error: ${log.slice(log.indexOf(': ') + 2)}`,
          })
        }
        depth--
      } else {
        if (depth === 0) {
          prettyLogs.push({
            logs: [],
            failed: false,
          })
          depth++
        }
        // system transactions don't start with "Program log:"
        prettyLogs[prettyLogs.length - 1].logs.push({
          prefix: prefixBuilder(depth),
          text: log,
          style: 'muted',
        })
      }
    }
  })

  // If the instruction's simulation returned an error without any logs then add an empty log entry for Runtime error
  // For example BpfUpgradableLoader fails without returning any logs for Upgrade instruction with buffer that doesn't exist
  if (prettyError && prettyLogs.length === 0) {
    prettyLogs.push({
      logs: [],
      failed: true,
    })
  }

  if (prettyError && prettyError.index === prettyLogs.length - 1) {
    const failedIx = prettyLogs[prettyError.index]
    failedIx.failed = true
    failedIx.logs.push({
      prefix: prefixBuilder(1),
      text: `Runtime error: ${prettyError.message}`,
      style: 'warning',
    })
  }

  return prettyLogs
}
