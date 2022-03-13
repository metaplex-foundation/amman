import { Relay } from '../../relay/server'
import { AmmanAccountProvider, AmmanAccountRendererMap } from '../../types'

export type RelayCommandArgs = {
  killRunningRelay: boolean
}

export function handleRelayCommand(
  accountProviders: Record<string, AmmanAccountProvider>,
  accountRenderers: AmmanAccountRendererMap,
  ignoreRunning: boolean
) {
  Relay.startServer(accountProviders, accountRenderers, !ignoreRunning)
}
