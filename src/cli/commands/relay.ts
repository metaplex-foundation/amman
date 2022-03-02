import { Relay } from '../../relay/server'

export type RelayCommandArgs = {
  killRunningRelay: boolean
}

export function handleRelayCommand(ignoreRunning: boolean) {
  Relay.startServer(!ignoreRunning)
}
