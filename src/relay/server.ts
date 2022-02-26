import { createServer, Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import { logDebug, logInfo, logTrace } from '../utils'
import { AMMAN_RELAY_PORT, MSG_UPDATE_ADDRESS_LABELS } from './consts'

class RelayServer {
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
    socket.on(MSG_UPDATE_ADDRESS_LABELS, (labels: Record<string, string>) => {
      if (logTrace.enabled) {
        const labelCount = Object.keys(labels).length
        logTrace(`Got ${labelCount} labels, broadcasting ...`)
      }
      socket.broadcast.emit(MSG_UPDATE_ADDRESS_LABELS, labels)
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

  static startServer(): Promise<{
    app: HttpServer
    io: Server
    relayServer: RelayServer
  }> {
    const { app, io, relayServer } = this.createApp()
    return new Promise((resolve, reject) => {
      app.on('error', reject).listen(AMMAN_RELAY_PORT, () => {
        logInfo('Server listening on %s', app.address())
        resolve({ app, io, relayServer })
      })
    })
  }
}
