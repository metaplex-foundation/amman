import { createServer, Server as HttpServer } from 'http'
import { AddressInfo } from 'net'
import { Server, Socket } from 'socket.io'
import { AccountProvider } from '../accounts/providers'
import { AccountStates } from '../accounts/state'
import { AmmanAccountProvider, AmmanAccountRendererMap } from '../types'
import { logDebug, logTrace } from '../utils'
import { killRunningServer } from '../utils/http'
import { Account, Program } from '../validator/types'
import {
  AMMAN_RELAY_PORT,
  MSG_GET_KNOWN_ADDRESS_LABELS,
  MSG_UPDATE_ADDRESS_LABELS,
  MSG_UPDATE_ACCOUNT_STATES,
  ACK_UPDATE_ADDRESS_LABELS,
  MSG_REQUEST_ACCOUNT_STATES,
  MSG_RESPOND_ACCOUNT_STATES,
  MSG_REQUEST_AMMAN_VERSION,
  MSG_RESPOND_AMMAN_VERSION,
} from './consts'
import { AMMAN_VERSION } from './types'

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
        logTrace(`socket.io ${client} disconnected`)
      )
      logTrace(`socket.io ${client} connected`)
      this.hookMessages(socket)
    })
  }

  hookMessages(socket: Socket) {
    const subscribedAccountStates = new Set<string>()
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
        const states = this.accountStates.get(pubkey)?.relayStates
        if (states != null) {
          socket.emit(MSG_RESPOND_ACCOUNT_STATES, pubkey, states)
        }
        if (!subscribedAccountStates.has(pubkey)) {
          subscribedAccountStates.add(pubkey)
          this.accountStates.on(`account-changed:${pubkey}`, (states) => {
            socket.emit(MSG_UPDATE_ACCOUNT_STATES, pubkey, states)
          })
        }
      })
      .on(MSG_REQUEST_AMMAN_VERSION, () => {
        socket.emit(MSG_RESPOND_AMMAN_VERSION, AMMAN_VERSION)
      })
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
    accounts: Account[],
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

    const programLabels = programs
      .filter((x) => x.label != null)
      .reduce((acc: Record<string, string>, x) => {
        acc[x.programId] = x.label!
        return acc
      }, {})

    const accountLabels = accounts
      .filter((x) => x.label != null)
      .reduce((acc: Record<string, string>, x) => {
        acc[x.accountId] = x.label!
        return acc
      }, {})

    const knownLabels = { ...programLabels, ...accountLabels }

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
