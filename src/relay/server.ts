import { createServer, Server as HttpServer } from 'http'
import { AddressInfo } from 'net'
import { Server, Socket } from 'socket.io'
import { AccountProvider } from '../accounts/providers'
import { AccountStates } from '../accounts/state'
import {
  AmmanAccount,
  AmmanAccountProvider,
  AmmanAccountRendererMap,
} from '../types'
import { logDebug, logTrace, safeJsonStringify } from '../utils'
import { killRunningServer } from '../utils/http'
import { Program } from '../validator/types'
import {
  AMMAN_RELAY_PORT,
  MSG_GET_KNOWN_ADDRESS_LABELS,
  MSG_UPDATE_ADDRESS_LABELS,
  MSG_WATCH_ACCOUNT_INFO,
  MSG_UPDATE_ACCOUNT_INFO,
  ACK_UPDATE_ADDRESS_LABELS,
  MSG_REQUEST_ACCOUNT_STATES,
  MSG_RESPOND_ACCOUNT_STATES,
} from './consts'

/**
 * A simple socket.io server which communicates to the Amman Explorere as well as accepting connections
 * from other clients, i.e. via an {@link AmmanClient} which tests can use to communicate via the amman API.
 *
 * @private
 */
class RelayServer {
  constructor(
    readonly io: Server,
    readonly accountProvider: AccountProvider,
    readonly accountStates: AccountStates,
    // Keyed pubkey:label
    private readonly allKnownLabels: Record<string, string> = {}
  ) {
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
        socket.emit(ACK_UPDATE_ADDRESS_LABELS)
      })
      .on(MSG_GET_KNOWN_ADDRESS_LABELS, () => {
        if (logTrace.enabled) {
          const labelCount = Object.keys(this.allKnownLabels).length
          logTrace(`Sending ${labelCount} known labels to requesting client.`)
        }
        socket.emit(MSG_UPDATE_ADDRESS_LABELS, this.allKnownLabels)
      })
      .on(MSG_REQUEST_ACCOUNT_STATES, (pubkey: string) => {
        const states = this.accountStates.get(pubkey).relayStates
        socket.emit(MSG_RESPOND_ACCOUNT_STATES, states)
      })
    /*
      .on(MSG_WATCH_ACCOUNT_INFO, async (accountAddress: string) => {
        this.accountProvider.watchAccount(
          accountAddress,
          (account: AmmanAccount, rendered?: string) => {
            if (socket.disconnected) return
            const pretty = account.pretty()
            if (logTrace.enabled) {
              logTrace(
                `Sending account ${safeJsonStringify({
                  pretty,
                  rendered,
                })} to ${socket.conn.remoteAddress}`
              )
            }
            socket.broadcast.emit(MSG_UPDATE_ACCOUNT_INFO, {
              accountAddress,
              accountInfo: { pretty, rendered },
            })
          }
        )
      })
      */
  }
}

/**
 * Sets up the Amman Relay which uses the given account provider to resolve account data.
 * @private
 * */
export class Relay {
  private static createApp(
    accountProvider: AccountProvider,
    accountStates: AccountStates,
    knownLabels: Record<string, string>
  ) {
    const server = createServer()
    const io = new Server(server, {
      cors: {
        origin: '*',
      },
    })
    const relayServer = new RelayServer(
      io,
      accountProvider,
      accountStates,
      knownLabels
    )
    return { app: server, io, relayServer }
  }

  static async startServer(
    accountProviders: Record<string, AmmanAccountProvider>,
    accountRenderers: AmmanAccountRendererMap,
    programs: Program[],
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
    AccountStates.createInstance(accountProvider.connection, accountProvider)

    const knownLabels = programs
      .filter((x) => x.label != null)
      .reduce((acc: Record<string, string>, x) => {
        acc[x.programId] = x.label!
        return acc
      }, {})
    const { app, io, relayServer } = this.createApp(
      accountProvider,
      AccountStates.instance,
      knownLabels
    )
    return new Promise((resolve, reject) => {
      app.on('error', reject).listen(AMMAN_RELAY_PORT, () => {
        const addr = app.address() as AddressInfo
        const msg = `Amman Relay listening on ${addr.address}:${addr.port}`
        logDebug(msg)
        resolve({ app, io, relayServer })
      })
    })
  }
}
