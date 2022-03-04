import io, { Socket } from 'socket.io-client'
import { logDebug, logTrace } from '../utils'
import {
  AMMAN_RELAY_PORT,
  MSG_CLEAR_ADDRESS_LABELS,
  MSG_CLEAR_TRANSACTIONS,
  MSG_UPDATE_ADDRESS_LABELS,
} from './consts'

/** @private */
export type AmmanClient = {
  clearAddressLabels(): void
  clearTransactions(): void
  addAddressLabels(labels: Record<string, string>): void
}

/** @private */
export class ConnectedAmmanClient implements AmmanClient {
  private readonly socket: Socket
  constructor(readonly url: string = `http://localhost:${AMMAN_RELAY_PORT}`) {
    this.socket = io(url, { autoUnref: true })
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

  addAddressLabels(labels: Record<string, string>) {
    if (logTrace.enabled) {
      const labelCount = Object.keys(labels).length
      logTrace(`Adding ${labelCount} address labels`)
    }
    this.socket.emit(MSG_UPDATE_ADDRESS_LABELS, labels)
  }

  private static _instance: ConnectedAmmanClient | undefined
  static getInstance(url?: string) {
    if (ConnectedAmmanClient._instance != null)
      return ConnectedAmmanClient._instance
    ConnectedAmmanClient._instance = new ConnectedAmmanClient(url).connect()
    return ConnectedAmmanClient._instance
  }
}

/** @private */
export class DisconnectedAmmanClient implements AmmanClient {
  clearAddressLabels(): void {}
  clearTransactions(): void {}
  addAddressLabels(_labels: Record<string, string>): void {}
}
