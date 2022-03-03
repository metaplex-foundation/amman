import io, { Socket } from 'socket.io-client'
import { logDebug, logTrace } from '../utils'
import { AMMAN_RELAY_PORT, MSG_UPDATE_ADDRESS_LABELS } from './consts'

/** @private */
export type AmmanClient = {
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
  addAddressLabels(_labels: Record<string, string>): void {}
}
