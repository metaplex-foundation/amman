import fs from 'fs'
import http, { Server } from 'http'
import path from 'path'
import { AMMAN_STORAGE_PORT, AMMAN_STORAGE_ROOT } from '.'
import { canRead, ensureDirSync, logDebug, logError, logTrace } from '../utils'

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

  start() {
    this.server = http
      .createServer(async (req, res) => {
        res.writeHead(200, { 'content-type': this.contentType })
        logTrace(`MockStorageServer: handling ${req.url}`)
        const url = new URL(req.url!)

        const resource = path.join(this.storageDir, url.pathname)
        if (!(await canRead(resource))) {
          logError(`MockStorageServer: failed to find ${resource}`)
          res.writeHead(404).end()
        } else {
          logDebug(`MockStorageServer: serving ${resource}`)
          res.writeHead(200)
          fs.createReadStream(resource).pipe(res)
        }
      })
      .listen(AMMAN_STORAGE_PORT)
  }

  stop() {
    this.server?.close()
  }
}
