import { createServer, Server as HttpServer } from 'http'
import { AddressInfo } from 'net'
import { Server, Socket } from 'socket.io'
import { AccountProvider } from '../accounts/providers'
import {
  AmmanAccount,
  AmmanAccountProvider,
  AmmanAccountRendererMap,
} from '../types'
import { logDebug, logInfo, logTrace } from '../utils'
import {
  AMMAN_RELAY_PORT,
  MSG_GET_KNOWN_ADDRESS_LABELS,
  MSG_UPDATE_ADDRESS_LABELS,
  MSG_WATCH_ACCOUNT_INFO,
  MSG_UPDATE_ACCOUNT_INFO,
} from './consts'
import { killRunningServer } from './server.kill'

/**
 * A simple socket.io server which communicates to the Amman Explorere as well as accepting connections
 * from other clients, i.e. via an {@link AmmanClient} which tests can use to communicate via the amman API.
 *
 * @private
 */
class RelayServer {
  private readonly allKnownLabels: Record<string, string> = {}
  constructor(readonly io: Server, readonly accountProvider: AccountProvider) {
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
      .on(MSG_WATCH_ACCOUNT_INFO, async (accountAddress: string) => {
        this.accountProvider.watchAccount(
          accountAddress,
          (account: AmmanAccount, rendered?: string) => {
            if (socket.disconnected) return
            const pretty = account.pretty()
            if (logTrace.enabled) {
              logTrace(
                `Sending account ${JSON.stringify({ pretty, rendered })} to ${
                  socket.conn.remoteAddress
                }`
              )
            }
            socket.emit(MSG_UPDATE_ACCOUNT_INFO, {
              accountAddress,
              accountInfo: { pretty, rendered },
            })
          }
        )
      })
  }
}

/**
 * Sets up the Amman Relay which uses the given account provider to resolve account data.
 * @private
 * */
export class Relay {
  private static createApp(accountProvider: AccountProvider) {
    const server = createServer()
    const io = new Server(server, {
      cors: {
        origin: '*',
      },
    })
    const relayServer = new RelayServer(io, accountProvider)
    return { app: server, io, relayServer }
  }

  static async startServer(
    accountProviders: Record<string, AmmanAccountProvider>,
    accountRenderers: AmmanAccountRendererMap,
    killRunning: boolean = true
  ): Promise<{
    app: HttpServer
    io: Server
    relayServer: RelayServer
  }> {
    if (killRunning) {
      await killRunningServer(AMMAN_RELAY_PORT)
    }
    const accountProvider = AccountProvider.fromRecord(
      accountProviders,
      accountRenderers
    )
    const { app, io, relayServer } = this.createApp(accountProvider)
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
