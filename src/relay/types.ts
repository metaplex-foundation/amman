import { AmmanAccountProvider } from '../types'

export const DEFAULT_RELAY_CONFIG: RelayConfig = {
  killRunningRelay: true,
  accountProviders: {},
}
export type RelayConfig = {
  killRunningRelay: boolean
  accountProviders: Record<string, AmmanAccountProvider>
}
