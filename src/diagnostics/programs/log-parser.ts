// https://github.com/solana-labs/solana/blob/cd09390367d2ac66e2269a39cd40c4b3097c6732/explorer/src/utils/program-logs.ts
import { TransactionError } from '@solana/web3.js'
import { Cluster, programLabel } from './program-names'
import { getTransactionInstructionError } from './program-err'
import { Amman } from '../../api'

export type LogMessage = {
  text: string
  prefix: string
  count?: number[]
  style: 'muted' | 'info' | 'success' | 'warning'
}

export type InstructionLogs = {
  logs: LogMessage[]
  failed: boolean
}

const txExecutedRx = /Transaction executed in slot/i

export class PrettyLogger {
  readonly prettyLogs: InstructionLogs[] = []
  instructionCount: number[] = []
  depth: number = 0

  constructor(readonly amman: Amman) {}

  private incDepth() {
    this.depth++
    this.instructionCount[this.depth - 1] = 0
  }

  private decDepth() {
    this.depth--
    if (this.depth >= 0) {
      this.instructionCount.length = this.depth
    }
  }

  private incInstructionCount() {
    const count = this.instructionCount[this.depth - 1] ?? 0
    this.instructionCount[this.depth - 1] = count + 1
  }

  private resetCount() {
    this.instructionCount = []
  }

  async addLine(
    line: string,
    error: TransactionError | null,
    cluster: Cluster
  ) {
    const newLogs = []
    let newTransaction = false
    const prefixBuilder = (depth: number) => {
      const prefix = new Array(depth - 1).fill('\u00A0\u00A0').join('')
      return prefix + '> '
    }

    let prettyError
    if (error) {
      prettyError = getTransactionInstructionError(error)
    }

    if (txExecutedRx.test(line)) {
      newTransaction = true
      this.resetCount()
    }
    if (line.startsWith('Program log:')) {
      const log: LogMessage = {
        prefix: prefixBuilder(this.depth),
        text: line,
        style: 'muted',
      }
      this.prettyLogs[this.prettyLogs.length - 1].logs.push(log)
      newLogs.push(log)
    } else {
      const regex = /Program (\w*) invoke \[(\d)\]/g
      const matches = [...line.matchAll(regex)]

      if (matches.length > 0) {
        // -----------------
        // Invoke Instruction
        // -----------------
        this.incInstructionCount()

        const programAddress = matches[0][1]
        const programName = await this.prettyProgramLabel(
          programAddress,
          cluster
        )

        if (this.depth === 0) {
          this.prettyLogs.push({
            logs: [],
            failed: false,
          })
        } else {
          const log: LogMessage = {
            prefix: prefixBuilder(this.depth),
            style: 'info',
            count: this.instructionCount.slice(),
            text: `Invoking ${programName}`,
          }
          this.prettyLogs[this.prettyLogs.length - 1].logs.push(log)
          newLogs.push(log)
        }
        this.incDepth()
      } else if (line.includes('success')) {
        // -----------------
        // Instruction Success
        // -----------------
        const log: LogMessage = {
          prefix: prefixBuilder(this.depth),
          style: 'success',
          text: `Program returned success`,
        }
        this.prettyLogs[this.prettyLogs.length - 1].logs.push(log)
        newLogs.push(log)
        this.decDepth()
      } else if (line.includes('failed')) {
        const instructionLog = this.prettyLogs[this.prettyLogs.length - 1]
        if (!instructionLog.failed) {
          instructionLog.failed = true
          const log: LogMessage = {
            prefix: prefixBuilder(this.depth),
            style: 'warning',
            text: `Program returned error: ${line.slice(
              line.indexOf(': ') + 2
            )}`,
          }
          instructionLog.logs.push(log)
          newLogs.push(log)
        }
        this.decDepth()
      } else {
        if (this.depth === 0) {
          this.prettyLogs.push({
            logs: [],
            failed: false,
          })
          this.incDepth()
        }
        // system transactions don't start with "Program log:"
        const log: LogMessage = {
          prefix: prefixBuilder(this.depth),
          text: line,
          style: 'muted',
        }
        this.prettyLogs[this.prettyLogs.length - 1].logs.push(log)
        newLogs.push(log)
      }
    }

    // If the instruction's simulation returned an error without any logs then add an empty log entry for Runtime error
    // For example BpfUpgradableLoader fails without returning any logs for Upgrade instruction with buffer that doesn't exist
    if (prettyError && this.prettyLogs.length === 0) {
      this.prettyLogs.push({
        logs: [],
        failed: true,
      })
    }

    if (prettyError && prettyError.index === this.prettyLogs.length - 1) {
      const failedIx = this.prettyLogs[prettyError.index]
      failedIx.failed = true

      const log: LogMessage = {
        prefix: prefixBuilder(1),
        text: `Runtime error: ${prettyError.message}`,
        style: 'warning',
      }
      failedIx.logs.push(log)
      newLogs.push(log)
    }

    return {
      newLogs,
      newTransaction,
    }
  }

  async prettyProgramLabel(programAddress: string, cluster: Cluster) {
    const programName = programLabel(programAddress, cluster)
    if (programName != null) return programName
    const resolvedProgramName = await this.amman.addr.resolveRemoteAddress(
      programAddress
    )
    return resolvedProgramName ?? `Unknown (${programAddress}) Program`
  }
}
