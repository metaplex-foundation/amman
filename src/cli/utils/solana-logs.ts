import { spawn } from 'child_process'
import split from 'split2'
import { Cluster, LogMessage, PrettyLogger } from '../../diagnostics/programs'
import colors from 'ansi-colors'
import { Amman } from '../../api'
import { logTrace } from '../../utils'

export async function pipeSolanaLogs(amman?: Amman) {
  const logger = new PrettyLogger(amman)
  const child = spawn('solana', ['logs'], {
    detached: false,
    stdio: 'pipe',
  })
  for await (const line of child.stdout?.pipe(split())) {
    try {
      await logLine(logger, line)
    } catch (err) {
      logTrace('Logger encountered an error', err)
    }
  }
}

async function logLine(logger: PrettyLogger, line: string) {
  const { newLogs, newTransaction } = await logger.addLine(
    line,
    null,
    Cluster.Amman
  )
  if (newTransaction) {
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
