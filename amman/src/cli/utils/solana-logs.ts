import { Amman, LOCALHOST } from '@metaplex-foundation/amman-client'
import {
  Commitment,
  Connection,
  Context,
  Logs,
  TransactionError,
} from '@solana/web3.js'
import colors from 'ansi-colors'
import { Cluster, LogMessage, PrettyLogger } from '../../diagnostics/programs'
import { logTrace } from '../../utils'

export async function pipeSolanaLogs(amman?: Amman, commitment?: Commitment) {
  const logger = new PrettyLogger(amman)
  commitment ??= 'confirmed'
  const connection = new Connection(LOCALHOST, commitment)
  connection.onLogs(
    'all',
    async (logs: Logs, _ctx: Context) => {
      // only include transaction err for last line, otherwise we'd log it for each
      for (let i = 0; i < logs.logs.length; i++) {
        const line = logs.logs[i]
        try {
          // only include transaction err for last line, otherwise we'd log it for each
          await logLine(logger, line, null)
        } catch (err) {
          logTrace('Logger encountered an error', err)
        }
      }
      if (logs.err != null) {
        await logLine(logger, '', logs.err)
      }
    },
    commitment
  )
}

async function logLine(
  logger: PrettyLogger,
  line: string,
  error: TransactionError | null
) {
  const { newLogs, newInstruction, newOuterInstruction } = await logger.addLine(
    line,
    error,
    Cluster.Amman
  )
  if (newOuterInstruction) {
    console.log(colors.dim('\n--------------------------------'))
  }
  if (newInstruction) {
    console.log('')
  }
  for (const log of newLogs) {
    const color = styleToColor(log.style)
    const count =
      log.count != null
        ? colors.bgGreen(colors.black(`#${log.count.join('.')} `)) + ' '
        : ''
    console.log(`${colors.dim(log.prefix)}${count}${color(log.text)}`)
  }
}

function styleToColor(style: LogMessage['style']) {
  switch (style) {
    case 'muted':
      return colors.dim
    case 'info':
      return colors.white
    case 'success':
      return colors.green
    case 'warning':
      return colors.redBright
    default:
      throw new Error(style)
  }
}
