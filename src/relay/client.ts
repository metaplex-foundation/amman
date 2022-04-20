import io, { Socket } from 'socket.io-client'
import { logDebug, logTrace } from '../utils'
import {
  ACK_UPDATE_ADDRESS_LABELS,
  MSG_CLEAR_ADDRESS_LABELS,
  MSG_CLEAR_TRANSACTIONS,
  MSG_UPDATE_ADDRESS_LABELS,
  AMMAN_RELAY_URI,
  MSG_GET_KNOWN_ADDRESS_LABELS,
  MSG_RESPOND_ACCOUNT_STATES,
  MSG_REQUEST_ACCOUNT_STATES,
} from './consts'
import { createTimeout } from './timeout'
import { RelayAccountState } from './types'

/** @private */
export type AmmanClient = {
  clearAddressLabels(): void
  clearTransactions(): void
  addAddressLabels(labels: Record<string, string>): Promise<void>
  fetchAddressLabels(): Promise<Record<string, string>>
  fetchAccountStates(address: string): Promise<RelayAccountState[]>
  disconnect(): void
}

export type AmmanClientOpts = { autoUnref?: boolean; ack?: boolean }

const AMMAN_UNABLE_ADD_LABELS = 'Unable to connect to send address labels'
const AMMAN_UNABLE_FETCH_LABELS = 'Unable to connect to fetch address labels'
const AMMAN_UNABLE_FETCH_ACCOUNT_STATES =
  'Unable to connect to fetch account states'
const AMMAN_NOT_RUNNING_ERROR = ', is amman running?\n'
'If not please start one in a separate terminal via `amman start`.\n' +
  'Alternatively do not set the `ack` option to `true` when instantiating the amman instance.'

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
          const timeout = createTimeout(
            2000,
            AMMAN_UNABLE_ADD_LABELS + AMMAN_NOT_RUNNING_ERROR,
            reject
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

  async fetchAddressLabels(): Promise<Record<string, string>> {
    logTrace('Fetching address labels')
    return new Promise<Record<string, string>>((resolve, reject) => {
      const timeout = createTimeout(
        2000,
        AMMAN_UNABLE_FETCH_LABELS + AMMAN_NOT_RUNNING_ERROR,
        reject
      )
      this.socket
        .on('error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
        .on(MSG_UPDATE_ADDRESS_LABELS, (labels: Record<string, string>) => {
          clearTimeout(timeout)
          logTrace('Got address labels %O', labels)
          resolve(labels)
        })
        .emit(MSG_GET_KNOWN_ADDRESS_LABELS)
    })
  }

  async fetchAccountStates(address: string) {
    logTrace('Fetching account states for %s', address)
    return new Promise<RelayAccountState[]>((resolve, reject) => {
      const timeout = createTimeout(
        2000,
        AMMAN_UNABLE_FETCH_ACCOUNT_STATES + AMMAN_NOT_RUNNING_ERROR,
        reject
      )
      this.socket
        .on('error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
        .on(
          MSG_RESPOND_ACCOUNT_STATES,
          (accountAddress: string, states: RelayAccountState[]) => {
            clearTimeout(timeout)
            logDebug(
              'Got account states for address %s, %O',
              accountAddress,
              states
            )
            resolve(states)
          }
        )
        .emit(MSG_REQUEST_ACCOUNT_STATES, address)
    })
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
  fetchAddressLabels(): Promise<Record<string, string>> {
    return Promise.resolve({})
  }
  fetchAccountStates(_address: string): Promise<RelayAccountState[]> {
    return Promise.resolve([])
  }
  disconnect() {}
}
