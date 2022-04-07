import { maybeAmmanInstance } from '../utils'
import { pipeSolanaLogs } from '../utils/solana-logs'

export function handleLogsCommand() {
  return pipeSolanaLogs(maybeAmmanInstance())
}
