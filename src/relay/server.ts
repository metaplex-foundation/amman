import { createServer, Server as HttpServer } from 'http'
import { AddressInfo } from 'net'
import { Server, Socket } from 'socket.io'
import { logDebug, logInfo, logTrace } from '../utils'
import {
  AMMAN_RELAY_PORT,
  MSG_GET_KNOWN_ADDRESS_LABELS,
  MSG_UPDATE_ADDRESS_LABELS,
} from './consts'
import { killRunningServer } from './server.kill'

class RelayServer {
  private readonly allKnownLabels: Record<string, string> = {}
  constructor(readonly io: Server) {
    this.hookConnectionEvents()
  }

  hookConnectionEvents() {
    this.io.on('connection', (socket) => {
      const client = `${socket.id} from ${socket.client.conn.remoteAddress}`
      socket.on('disconnect', () =>
        logDebug(`socket.io ${client} disconnected`)
      )
      logDebug(`socket.io ${client} connected`)
      this.hookMessages(socket)
    })
  }

  hookMessages(socket: Socket) {
    socket
      .on(MSG_UPDATE_ADDRESS_LABELS, (labels: Record<string, string>) => {
        if (logTrace.enabled) {
          const labelCount = Object.keys(labels).length
          logTrace(`Got ${labelCount} labels, broadcasting ...`)
        }
        for (const [key, val] of Object.entries(labels)) {
          this.allKnownLabels[key] = val
        }
        socket.broadcast.emit(MSG_UPDATE_ADDRESS_LABELS, labels)
      })
      .on(MSG_GET_KNOWN_ADDRESS_LABELS, () => {
        if (logTrace.enabled) {
          const labelCount = Object.keys(this.allKnownLabels).length
          logTrace(`Sending ${labelCount} known labels to requesting client.`)
        }
        socket.emit(MSG_UPDATE_ADDRESS_LABELS, this.allKnownLabels)
      })
  }
}

export class Relay {
  private static createApp() {
    const server = createServer()
    const io = new Server(server, {
      cors: {
        origin: '*',
      },
    })
    const relayServer = new RelayServer(io)
    return { app: server, io, relayServer }
  }

  static async startServer(killRunning: boolean = true): Promise<{
    app: HttpServer
    io: Server
    relayServer: RelayServer
  }> {
    if (killRunning) {
      await killRunningServer(AMMAN_RELAY_PORT)
    }
    const { app, io, relayServer } = this.createApp()
    return new Promise((resolve, reject) => {
      app.on('error', reject).listen(AMMAN_RELAY_PORT, () => {
        const addr = app.address() as AddressInfo
        const msg = `Amman Relay listening on ${addr.address}:${addr.port}`
        if (logInfo.enabled) {
          logInfo(msg)
        } else {
          console.log(msg)
        }
        resolve({ app, io, relayServer })
      })
    })
  }
}