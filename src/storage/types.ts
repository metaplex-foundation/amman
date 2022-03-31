export const ContentTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/svg+xml',
  'image/webp',
  'image/x-icon',
] as const

export type ContentType = typeof ContentTypes[number]

/**
 * Configures the Amman Mock Storage
 *
 * @category config
 */
export type StorageConfig = {
  enabled: boolean
  storageId: string
  clearOnStart: boolean
}

/**
 * The Default Amman Storage Configuration
 *
 * @category config
 */
export const DefaultStorageConfig: Omit<StorageConfig, 'storageId'> = {
  enabled: process.env.CI == null,
  clearOnStart: true,
}
