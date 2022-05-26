export const DEFAULT_ASSETS_FOLDER = '.amman'
export const ACCOUNTS_FOLDER = 'accounts'

/**
 * Configures amman snapshots.
 *
 * @property snapshotFolder - Relative path to the folder where snapshots are stored.
 * @property load - Label of the snapshot to load from the snapshot folder.
 */
export type SnapshotConfig = {
  snapshotFolder: string
  load?: string
}

export const DEFAULT_SNAPSHOT_CONFIG: SnapshotConfig = {
  snapshotFolder: 'snapshots',
}
