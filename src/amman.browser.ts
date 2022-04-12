/**
 * Amman is not meant to be used in the browser, but we need to share some constants and types that
 * are needed to integrate the amman-explorer witht he backend.
 */
export { LOCALHOST, identifySolanaAddress } from './utils'
export * from './types'
export * from './relay/consts'
export * from './relay/types'
export * from './storage/consts'
export * from './storage/types'
