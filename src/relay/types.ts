import { AmmanAccountProvider, AmmanAccountRendererMap } from '../types'

/**
 * The Default Amman Relay Configuration
 *
 * @category config
 */
export const DEFAULT_RELAY_CONFIG: RelayConfig = {
  killRunningRelay: true,
  accountProviders: {},
  accountRenderers: new Map(),
}

/**
 * Configures the Amman Relay
 *
 * @category config
 */
export type RelayConfig = {
  killRunningRelay: boolean
  accountProviders: Record<string, AmmanAccountProvider>
  accountRenderers: AmmanAccountRendererMap
}
