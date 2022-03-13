import { Relay } from '../../relay/server'
import { AmmanAccountProvider } from '../../types'

export type RelayCommandArgs = {
  killRunningRelay: boolean
}

export function handleRelayCommand(
  accountProviders: Record<string, AmmanAccountProvider>,
  ignoreRunning: boolean
) {
  Relay.startServer(accountProviders, !ignoreRunning)
}
