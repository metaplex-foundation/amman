export const DEFAULT_ASSETS_FOLDER = '.amman'
export const ACCOUNTS_FOLDER = 'accounts'

export type SnapshotConfig = {
  snapshotFolder: string
  loadSnapshot?: string
}

export const DEFAULT_SNAPSHOT_CONFIG: SnapshotConfig = {
  snapshotFolder: 'snapshots',
}
