import fs from 'fs'
import http, {
  IncomingMessage,
  Server,
  ServerResponse,
  STATUS_CODES,
} from 'http'
import path from 'path'
import { AMMAN_STORAGE_PORT, StorageConfig } from '.'
import { scopedLog } from '../utils/log'
import { canRead, ensureDir } from '../utils/fs'
import { DEFAULT_STORAGE_CONFIG } from './types'
import { tmpdir } from 'os'

export const AMMAN_STORAGE_ROOT = path.join(tmpdir(), 'amman-storage')

const logError = scopedLog('error', 'mock-storage')
const logDebug = scopedLog('debug', 'mock-storage')
const logTrace = scopedLog('trace', 'mock-storage')

export class MockStorageServer {
  server?: Server

  private constructor(readonly storageDir: string) {}

  static _instance: MockStorageServer | undefined
  static get existingInstance() {
    return MockStorageServer._instance
  }
  static async createInstance(storageConfig: StorageConfig) {
    if (MockStorageServer._instance == null) {
      const { storageId, clearOnStart } = {
        ...DEFAULT_STORAGE_CONFIG,
        ...storageConfig,
      }
      const storageDir = path.join(AMMAN_STORAGE_ROOT, storageId)
      await ensureDir(storageDir, clearOnStart)
      return (MockStorageServer._instance = new MockStorageServer(storageDir))
    } else {
      throw new Error('MockStorageServer instance can only be created once')
    }
  }

  start(): Promise<Server> {
    this.server = http
      .createServer(async (req, res) => {
        if (req.method?.toLowerCase() === 'options') {
          writeStatusHead(res, 200)
          return res.end('OK')
        }
        const url = req.url?.trim()
        if (url == null || url.length === 0) {
          return fail(res, 'Url is required')
        }

        if (url.startsWith('/upload')) {
          if (req.method?.toLowerCase() !== 'post') {
            return fail(res, 'Only POST is supported for uploads')
          }
          const resourceName = url.slice('/upload/'.length)
          if (resourceName.length === 0) {
            return fail(res, 'Resource to upload is required')
          }
          const resource = path.join(AMMAN_STORAGE_ROOT, resourceName)
          return handleUpload(req, res, resource)
        }

        const resourceName = url.slice(1)
        if (resourceName.length === 0) {
          return fail(res, 'Resource to load is required')
        }

        const resource = path.join(AMMAN_STORAGE_ROOT, resourceName)
        if (!(await canRead(resource))) {
          logError(`failed to find ${resource}`)
          writeStatusHead(res, 404)
          res.end()
        } else {
          logDebug(`serving ${resource}`)
          writeStatusHead(res, 200)
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

// -----------------
// Helpers
// -----------------
function writeStatusHead(res: ServerResponse, status: number) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE, PUT',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': 2592000, // 30 days
  })
}

function fail(res: ServerResponse, msg: string, statusCode = 422) {
  writeStatusHead(res, statusCode)
  res.end(`${STATUS_CODES[statusCode]}: ${msg}`)
}

function handleUpload(
  req: IncomingMessage,
  res: ServerResponse,
  resource: string
) {
  const contentLength = parseInt(req.headers?.['content-length'] ?? '')
  if (isNaN(contentLength) || contentLength <= 0) {
    return fail(res, 'Missing File to Upload', 411)
  }
  logTrace(`uploading ${contentLength} bytes to ${resource}`)

  const dstStream = fs.createWriteStream(resource)

  let failed = false
  dstStream.on('error', (error) => {
    logError(error)
    failed = true
    fail(res, 'Upload failed', 500)
  })

  req.pipe(dstStream)

  req.on('end', () => {
    dstStream.close(() => {
      if (!failed) {
        writeStatusHead(res, 200)
        res.end()
      }
    })
  })
}
