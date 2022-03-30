import io, { Socket } from 'socket.io-client'
import { logDebug, logTrace } from '../utils'
import {
  ACK_UPDATE_ADDRESS_LABELS,
  MSG_CLEAR_ADDRESS_LABELS,
  MSG_CLEAR_TRANSACTIONS,
  MSG_UPDATE_ADDRESS_LABELS,
  AMMAN_RELAY_URI,
} from './consts'

/** @private */
export type AmmanClient = {
  clearAddressLabels(): void
  clearTransactions(): void
  addAddressLabels(labels: Record<string, string>): Promise<void>
  disconnect(): void
}

export type AmmanClientOpts = { autoUnref?: boolean; ack?: boolean }

/** @private */
export class ConnectedAmmanClient implements AmmanClient {
  private readonly socket: Socket
  private readonly ack: boolean
  private constructor(readonly url: string, opts: AmmanClientOpts = {}) {
    const { autoUnref = true, ack = false } = opts
    this.ack = ack
    this.socket = io(url, { autoUnref })
  }
  private connect() {
    if (this.socket.connected) return this
    this.socket.connect()
    logDebug('AmmanClient connected')
    return this
  }

  clearAddressLabels() {
    this.socket.emit(MSG_CLEAR_ADDRESS_LABELS)
  }

  clearTransactions() {
    this.socket.emit(MSG_CLEAR_TRANSACTIONS)
  }

  addAddressLabels(labels: Record<string, string>): Promise<void> {
    if (logTrace.enabled) {
      const labelCount = Object.keys(labels).length
      logTrace(`Adding ${labelCount} address labels`)
    }
    const promise = this.ack
      ? new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () =>
              reject(
                new Error(
                  'Unable to connect to send address labels, is amman running?\n' +
                    'If not please start one in a separate terminal via `amman start`.\n' +
                    'Alternatively do not set the `ack` option to `true` when instantiating the amman instance.'
                )
              ),
            2000
          )
          this.socket
            .on('error', (err) => {
              clearTimeout(timeout)
              reject(err)
            })
            .on(ACK_UPDATE_ADDRESS_LABELS, () => {
              logTrace('Got ack for address labels update %O', labels)
              clearTimeout(timeout)
              resolve()
            })
        })
      : Promise.resolve()

    this.socket.emit(MSG_UPDATE_ADDRESS_LABELS, labels)
    return promise
  }

  /**
   * Disconnects this client and allows the app to shut down.
   * Only needed if you set `{ autoUnref: false }` for the opts.
   */
  disconnect() {
    this.socket.disconnect()
  }

  private static _instance: ConnectedAmmanClient | undefined
  static getInstance(url?: string, ammanClientOpts?: AmmanClientOpts) {
    if (ConnectedAmmanClient._instance != null)
      return ConnectedAmmanClient._instance
    ConnectedAmmanClient._instance = new ConnectedAmmanClient(
      url ?? AMMAN_RELAY_URI,
      ammanClientOpts
    ).connect()
    return ConnectedAmmanClient._instance
  }
}

/** @private */
export class DisconnectedAmmanClient implements AmmanClient {
  clearAddressLabels(): void {}
  clearTransactions(): void {}
  addAddressLabels(_labels: Record<string, string>): Promise<void> {
    return Promise.resolve()
  }
  disconnect() {}
}
