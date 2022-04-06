import { cliAmmanInstance } from '../utils'
import { pipeSolanaLogs } from '../utils/solana-logs'

export function handleLogsCommand() {
  return pipeSolanaLogs(cliAmmanInstance())
}
