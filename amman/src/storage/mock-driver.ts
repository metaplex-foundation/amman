import type {
  Metaplex,
  MetaplexFile,
  MetaplexPlugin,
} from '@metaplex-foundation/js-next'
import { SolAmount } from '@metaplex-foundation/js-next'
import { StorageDriver } from './storage-driver'
import {
  AMMAN_STORAGE_UPLOAD_URI,
  AMMAN_STORAGE_URI,
} from '@metaplex-foundation/amman-core'

import { strict as assert } from 'assert'
import BN from 'bn.js'
import path from 'path'
import {
  logInfo as ammanLogInfo,
  logDebug as ammanLogDebug,
  logTrace as ammanLogTrace,
  logError,
} from '../utils/log'
import { canAccessSync } from '../utils/fs'
import { promises as fs } from 'fs'
import { assertValidPathSegmentWithoutSpaces } from '../utils/path'

const DEFAULT_COST_PER_BYTE = new BN(1)

export type AmmanMockStorageDriverOptions = {
  uploadRoot?: string
  costPerByte?: BN | number
  logInfo?: (...data: any[]) => void
  logDebug?: (...data: any[]) => void
  logTrace?: (...data: any[]) => void
}

// @ts-ignore
export class AmmanMockStorageDriver extends StorageDriver {
  private cache: Record<string, MetaplexFile> = {}

  readonly baseResourceUrl: string
  readonly baseUploadUrl: string

  constructor(
    metaplex: Metaplex,
    readonly storageId: string,
    readonly costPerByte: BN,
    readonly logInfo: (...data: any[]) => void,
    readonly logDebug: (...data: any[]) => void,
    readonly logTrace: (...data: any[]) => void,
    readonly uploadRoot?: string
  ) {
    super(metaplex)
    assertValidPathSegmentWithoutSpaces(
      storageId,
      'please select a different storage id'
    )

    this.baseResourceUrl = AmmanMockStorageDriver.getStorageUri(storageId)
    this.baseUploadUrl = AmmanMockStorageDriver.getUploadToStorageUri(storageId)
    this.logInfo(`Amman Storage Driver with '${storageId}' initialized`)
    this.logDebug({
      uploadRoot,
      baseUrl: this.baseResourceUrl,
    })
  }

  static readonly create = (
    storageId: string,
    options: AmmanMockStorageDriverOptions = {}
  ): MetaplexPlugin => {
    const {
      costPerByte = DEFAULT_COST_PER_BYTE,
      logInfo = ammanLogInfo,
      logDebug = ammanLogDebug,
      logTrace = ammanLogTrace,
      uploadRoot,
    } = options
    return {
      install: (metaplex: /* Metaplex */ any) =>
        metaplex.setStorageDriver(
          new AmmanMockStorageDriver(
            metaplex,
            storageId,
            new BN(costPerByte),
            logInfo,
            logDebug,
            logTrace,
            uploadRoot
          )
        ),
    }
  }

  static readonly getStorageUri = (storageId: string) =>
    `${AMMAN_STORAGE_URI}/${storageId}`

  static readonly getUploadToStorageUri = (storageId: string) =>
    `${AMMAN_STORAGE_UPLOAD_URI}/${storageId}`

  public async getPrice(file: MetaplexFile): Promise<SolAmount> {
    return SolAmount.fromLamports(
      new BN(file.buffer.byteLength).mul(this.costPerByte)
    )
  }

  public async upload(file: MetaplexFile): Promise<string> {
    this.logTrace(file)
    const resourceName = file.uniqueName
    const uploadUri = `${this.baseUploadUrl}/${resourceName}`
    const resourceUri = `${this.baseResourceUrl}/${resourceName}`

    let buf: Buffer
    // JSON files include inline metadata instead of referencing an image to upload
    if (file.contentType === 'application/json' || file.buffer.byteLength > 0) {
      buf = file.toBuffer()
    } else {
      assert(
        this.uploadRoot != null,
        'uploadRoot needs to be set in options to load from file system'
      )
      assert(
        canAccessSync(this.uploadRoot),
        `uploadRoot '${this.uploadRoot}' must be accessible, but is not`
      )
      // Read from upload directory
      const fullSrc = path.join(this.uploadRoot, file.fileName)
      buf = await fs.readFile(fullSrc)
    }
    await uploadBuffer(uploadUri, buf)

    this.logDebug(`Uploaded ${file.displayName}:${file.uniqueName}`)

    this.cache[resourceUri] = file

    return resourceUri
  }

  public async download(uri: string): Promise<MetaplexFile> {
    const file = this.cache[uri]
    assert(file != null, `file '${uri}' not found`)
    return file
  }

  public async downloadJson<T extends object>(uri: string): Promise<T> {
    const file = await this.download(uri)
    return JSON.parse(file.toString())
  }
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
