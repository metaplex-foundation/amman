import { scopedLog } from '../utils/log'
import { AMMAN_STORAGE_UPLOAD_URI, AMMAN_STORAGE_URI } from './consts'
import { Amount, MetaplexFile, sol, StorageDriver } from './sdk-types'

const { logError, logDebug } = scopedLog('mock-storage')

export function ammanMockStorage(storageId: string, costPerByte?: number) {
  return new AmmanMockStorageDriver(storageId, costPerByte)
}

class AmmanMockStorageDriver implements StorageDriver {
  private cache: Record<string, MetaplexFile> = {}

  readonly baseResourceUrl: string
  readonly baseUploadUrl: string

  constructor(readonly storageId: string, readonly costPerByte: number = 1) {
    this.baseResourceUrl = AmmanMockStorageDriver.getStorageUri(storageId)
    this.baseUploadUrl = AmmanMockStorageDriver.getUploadToStorageUri(storageId)
    logDebug(`Amman Storage Driver for ${this.baseResourceUrl} initialized`)
  }

  getUploadPrice: (bytes: number) => Promise<Amount> = (bytes) => {
    const price = bytes * this.costPerByte
    const amount = sol(price)
    return Promise.resolve(amount)
  }

  upload: (file: MetaplexFile) => Promise<string> = async (file) => {
    const resourceName = file.uniqueName
    const uploadUri = `${this.baseUploadUrl}/${resourceName}`
    const resourceUri = `${this.baseResourceUrl}/${resourceName}`
    const buf = file.buffer

    await uploadBuffer(uploadUri, buf)

    logDebug(`Uploaded ${file.displayName}:${file.uniqueName}`)

    this.cache[resourceUri] = file

    return resourceUri
  }

  uploadAll: (files: MetaplexFile[]) => Promise<string[]> = async (files) => {
    return Promise.all(files.map(this.upload))
  }

  download: (uri: string, options?: RequestInit) => Promise<MetaplexFile> = (
    uri,
    _options
  ) => {
    const file = this.cache[uri]

    if (file == null) {
      throw new Error(`Asset for ${uri} not found`)
    }

    return Promise.resolve(file)
  }

  static readonly getStorageUri = (storageId: string) =>
    `${AMMAN_STORAGE_URI}/${storageId}`

  static readonly getUploadToStorageUri = (storageId: string) =>
    `${AMMAN_STORAGE_UPLOAD_URI}/${storageId}`
}

// -----------------
// Helpers
// -----------------
export async function uploadBuffer(url: string, buf: Buffer) {
  const byteSize = buf.byteLength
  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        contentLength: `${byteSize}`,
      },
      body: buf,
    })
  } catch (err) {
    logError(`Error uploading ${url}: ${err}`)
  }
}
