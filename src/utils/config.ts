import path from 'path'
import {
  ACCOUNTS_FOLDER,
  DEFAULT_ASSETS_FOLDER,
  DEFAULT_SNAPSHOT_CONFIG,
} from '../assets'
import { DEFAULT_RELAY_CONFIG } from '../relay/types'
import { AmmanConfig } from '../types'
import { DEFAULT_VALIDATOR_CONFIG } from '../validator'

export const DEFAULT_STREAM_TRANSACTION_LOGS = process.env.CI == null

export const DEFAULT_START_CONFIG: AmmanConfig = {
  validator: DEFAULT_VALIDATOR_CONFIG,
  relay: DEFAULT_RELAY_CONFIG,
  snapshot: DEFAULT_SNAPSHOT_CONFIG,
  streamTransactionLogs: DEFAULT_STREAM_TRANSACTION_LOGS,
  assetsFolder: DEFAULT_ASSETS_FOLDER,
}

/**
 * Need a hand rolled version of this since tools like deep-extend don't work
 * with maps and classes and thus break things like account renderers
 *
 * @private
 */
export function completeConfig(config: Partial<AmmanConfig> = {}): AmmanConfig {
  const validator = { ...DEFAULT_VALIDATOR_CONFIG, ...config.validator }
  const relay = { ...DEFAULT_RELAY_CONFIG, ...config.relay }
  const snapshot = { ...DEFAULT_SNAPSHOT_CONFIG, ...config.snapshot }
  snapshot.snapshotFolder = path.resolve(process.cwd(), snapshot.snapshotFolder)

  const {
    streamTransactionLogs = DEFAULT_STREAM_TRANSACTION_LOGS,
    assetsFolder = DEFAULT_ASSETS_FOLDER,
  } = config
  return { validator, relay, snapshot, streamTransactionLogs, assetsFolder }
}

export function fullAccountsDir(assetsFolder?: string): string {
  const assetsDir = path.resolve(
    process.cwd(),
    assetsFolder ?? DEFAULT_ASSETS_FOLDER
  )
  return path.join(assetsDir, ACCOUNTS_FOLDER)
}
