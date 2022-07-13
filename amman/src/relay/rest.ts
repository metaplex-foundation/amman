import {
  MSG_GET_KNOWN_ADDRESS_LABELS,
  MSG_REQUEST_ACCOUNT_SAVE,
  MSG_REQUEST_ACCOUNT_STATES,
  MSG_REQUEST_AMMAN_VERSION,
  MSG_REQUEST_LOAD_KEYPAIR,
  MSG_REQUEST_LOAD_SNAPSHOT,
  MSG_REQUEST_SET_ACCOUNT,
  MSG_REQUEST_SNAPSHOT_SAVE,
  MSG_REQUEST_STORE_KEYPAIR,
  MSG_REQUEST_VALIDATOR_PID,
  MSG_UPDATE_ADDRESS_LABELS,
} from '@metaplex-foundation/amman-client'
import {
  IncomingMessage,
  Server as HttpServer,
  ServerResponse,
  STATUS_CODES,
} from 'http'
import { scopedLog } from '../utils/log'
import { RelayHandler } from './handler'
import { AMMAN_VERSION } from './types'

const { logTrace } = scopedLog('rest-server')

/**
 * The rest server exposes similar functionality that is available via the socket.io interface.
 *
 * The main difference is that only request/response functionality is supported.
 *
 * ### Interface
 *
 * Args to a POST method are expected to be passed in a tuple of varying sizes, aka array.
 *
 * Return values from a POST or GET take on two shapes:
 *
 * #### Return value only indicating success or failure of the operation:
 *
 * ```
 * {
 *   success: boolean // set only on success
 *   err: string      // set onlhy in an error case
 * }
 * ```
 *
 * #### Return value passing along a return arg
 *
 * ```
 * {
 *   result: any      // set only on success
 *   err: string      // set onlhy in an error case
 * }
 *
 * ```
 */
export class RestServer {
  private constructor(
    readonly app: HttpServer,
    readonly handler: RelayHandler
  ) {
    app.on('request', async (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url?.trim()
      // handled by the socket io server
      if (url?.startsWith('/socket.io')) return

      logTrace(req.url)
      if (url == null || url.length === 0) {
        return fail(res, 'Url is required')
      }

      try {
        switch (url.slice(1)) {
          // -----------------
          // Amman Version
          // -----------------
          case MSG_REQUEST_AMMAN_VERSION: {
            send(res, { result: AMMAN_VERSION })
            break
          }
          // -----------------
          // Validator Pid
          // -----------------
          case MSG_REQUEST_VALIDATOR_PID:
            if (!assertGet(req, res, url)) return
            const reply = handler.requestValidatorPid()
            send(res, reply)
            break
          // -----------------
          // Address Labels
          // -----------------
          case MSG_UPDATE_ADDRESS_LABELS: {
            if (!assertPost(req, res, url)) return
            const [labels] = await reqArgs(req)
            this.handler.updateAddressLabels(labels)
            send(res, {})
            break
          }
          case MSG_GET_KNOWN_ADDRESS_LABELS: {
            if (!assertGet(req, res, url)) return
            send(res, { result: this.handler.allKnownLabels })
            break
          }
          // -----------------
          // Account States
          // -----------------
          case MSG_REQUEST_ACCOUNT_STATES: {
            if (!assertPost(req, res, url)) return
            const [pubkeyArg] = await reqArgs(req)
            const [pubkey, states] =
              this.handler.requestAccountStates(pubkeyArg)
            send(res, { result: [pubkey, states] })
            break
          }
          // -----------------
          // Save Account
          // -----------------
          case MSG_REQUEST_ACCOUNT_SAVE: {
            if (!assertPost(req, res, url)) return
            const [pubkeyArg] = await reqArgs(req)
            // TODO(thlorenz): for consistency the handler should return a `{ result }` reply
            // make sure we don't break amman-client that's also using the handler
            const [pubkey, result] = await this.handler.requestAccountSave(
              pubkeyArg
            )
            send(res, { result: [pubkey, result] })
            break
          }
          // -----------------
          // Snapshot
          // -----------------
          case MSG_REQUEST_SNAPSHOT_SAVE: {
            if (!assertPost(req, res, url)) return
            const [label] = await reqArgs(req)
            // TODO(thlorenz): for consistency the handler should return a `{ result }` reply
            // make sure we don't break amman-client that's also using the handler
            const result = await this.handler.requestSnapshotSave(label)
            send(res, result)
            break
          }
          case MSG_REQUEST_LOAD_SNAPSHOT: {
            if (!assertPost(req, res, url)) return
            const [label] = await reqArgs(req)
            const reply = await this.handler.requestLoadSnapshot(label)
            send(res, reply)
            break
          }
          // -----------------
          // Keypair
          // -----------------
          case MSG_REQUEST_STORE_KEYPAIR: {
            if (!assertPost(req, res, url)) return
            const [id, secretKey] = await reqArgs(req)
            const reply = this.handler.requestStoreKeypair(id, secretKey)
            send(res, reply)
            break
          }
          case MSG_REQUEST_LOAD_KEYPAIR: {
            if (!assertPost(req, res, url)) return
            const [id] = await reqArgs(req)
            const result = this.handler.requestLoadKeypair(id)
            send(res, { result })
            break
          }
          // -----------------
          // Set Account
          // -----------------
          case MSG_REQUEST_SET_ACCOUNT: {
            if (!assertPost(req, res, url)) return
            const [account] = await reqArgs(req)
            const reply = this.handler.requestSetAccount(account)
            send(res, reply)
            break
          }
          default:
            fail(res, `Unknown route ${url}`)
        }
      } catch (err: any) {
        fail(res, err.toString(), 500)
      }
    })
  }

  static init(app: HttpServer, relayHandler: RelayHandler) {
    return new RestServer(app, relayHandler)
  }
}

// -----------------
// Helpers
// -----------------
function assertPost(req: IncomingMessage, res: ServerResponse, url: string) {
  if (req.method?.toUpperCase() !== 'POST') {
    fail(res, `${url} needs to be POST`, 405)
    return false
  }
  return true
}

function assertGet(req: IncomingMessage, res: ServerResponse, url: string) {
  if (req.method?.toUpperCase() !== 'GET') {
    fail(res, `${url} needs to be GET`, 405)
    return false
  }
  return true
}

async function reqArgs(req: IncomingMessage): Promise<any[]> {
  const buffers = []
  for await (const chunk of req) {
    buffers.push(chunk)
  }

  const data = Buffer.concat(buffers).toString()
  try {
    const args = JSON.parse(data)
    logTrace({ args })
    return args
  } catch (err: any) {
    throw new Error(
      `Failed to parse JSON input: ${data.toString()}\n${err.toString()}`
    )
  }
}

function send(res: ServerResponse, payload: any) {
  writeStatusHead(res, 200)
  try {
    const json = JSON.stringify(payload)
    res.end(json)
  } catch (err: any) {
    fail(res, `Failed to stringify payload: ${payload.toString()}`)
  }
}

function fail(res: ServerResponse, msg: string, statusCode = 422) {
  writeStatusHead(res, statusCode)
  res.end(JSON.stringify({ err: `${STATUS_CODES[statusCode]}: ${msg}` }))
}

function writeStatusHead(res: ServerResponse, status: number) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE, PUT',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': 2592000, // 30 days
  })
}
