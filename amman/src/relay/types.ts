import { AmmanAccountProvider, AmmanAccountRendererMap } from '../types'

/** The version of amman, used by amman-explorer to detect amman compatibility */
const { version } = require('../../package.json')
export const AMMAN_VERSION: [number, number, number] = version
  .split('.')
  .map((v: string) => parseInt(v)) as [number, number, number]

/**
 * The Default Amman Relay Configuration
 *
 * @category config
 */
export const DEFAULT_RELAY_CONFIG: RelayConfig = {
  enabled: process.env.CI == null,
  killRunningRelay: true,
  accountProviders: {},
  accountRenderers: new Map(),
}

/**
 * Configures the Amman Relay
 *
 * @property enabled if true an amman-explorer relay is launched alongside the
 * validator
 * @property killRunningRelay if true an existing running relays are killed at
 * start
 * @property accountProviders a map of account providers which the relay uses
 * to deserialize account data
 * @property accountRenderers a map of account providers which the relay uses
 * to custom render account data
 *
 * @category config
 */
export type RelayConfig = {
  enabled: boolean
  killRunningRelay: boolean
  accountProviders: Record<string, AmmanAccountProvider>
  accountRenderers: AmmanAccountRendererMap
}
