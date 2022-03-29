import fs from 'fs'
import http, { Server } from 'http'
import path from 'path'
import { AMMAN_STORAGE_PORT, AMMAN_STORAGE_ROOT } from '.'
import { logDebug, logError, logTrace } from '../utils'
import { canRead, ensureDirSync } from '../utils/fs'

export class MockStorageServer {
  readonly storageDir: string
  server?: Server

  constructor(readonly storageId: string, readonly contentType = 'image/png') {
    this.storageDir = path.join(AMMAN_STORAGE_ROOT, storageId)
    ensureDirSync(this.storageDir)
  }

  static _instance: MockStorageServer | undefined
  static createInstance(storageId: string, contentType?: string) {
    if (MockStorageServer._instance == null) {
      return (MockStorageServer._instance = new MockStorageServer(
        storageId,
        contentType
      ))
    } else {
      throw new Error('MockStorageServer instance can only be created once')
    }
  }

  start(): Promise<Server> {
    this.server = http
      .createServer(async (req, res) => {
        logTrace(`MockStorageServer: handling ${req.url}`)

        const resource = path.join(AMMAN_STORAGE_ROOT, req.url!.slice(1))
        if (!(await canRead(resource))) {
          logError(`MockStorageServer: failed to find ${resource}`)
          res.writeHead(404).end()
        } else {
          logDebug(`MockStorageServer: serving ${resource}`)
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
            'Access-Control-Max-Age': 2592000, // 30 days
          })
          fs.createReadStream(resource).pipe(res)
        }
      })
      .unref()

    const promise: Promise<Server> = new Promise((resolve, reject) => {
      this.server!.on('error', reject).on('listening', () =>
        resolve(this.server!)
      )
    })

    this.server.listen(AMMAN_STORAGE_PORT)

    return promise
  }

  stop() {
    this.server?.close()
  }
}
