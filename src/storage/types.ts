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

export type StorageConfig = {
  storageId: string
  contentType?: ContentType
}
