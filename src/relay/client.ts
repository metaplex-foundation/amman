import io, { Socket } from 'socket.io-client'
import { logDebug, logTrace } from '../utils'
import { AMMAN_RELAY_PORT, MSG_UPDATE_ADDRESS_LABELS } from './consts'

export class AmmanClient {
  readonly socket: Socket
  constructor(readonly url: string = `http://localhost:${AMMAN_RELAY_PORT}`) {
    this.socket = io(url, { autoUnref: true })
  }
  connect() {
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

  private static _instance: AmmanClient | undefined
  static getInstance(url?: string) {
    if (AmmanClient._instance != null) return AmmanClient._instance
    AmmanClient._instance = new AmmanClient(url).connect()
    return AmmanClient._instance
  }
}
