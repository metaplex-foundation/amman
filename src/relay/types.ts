import { AmmanAccountProvider, AmmanAccountRendererMap } from '../types'

export const DEFAULT_RELAY_CONFIG: RelayConfig = {
  killRunningRelay: true,
  accountProviders: {},
  accountRenderers: new Map(),
}
export type RelayConfig = {
  killRunningRelay: boolean
  accountProviders: Record<string, AmmanAccountProvider>
  accountRenderers: AmmanAccountRendererMap
}
