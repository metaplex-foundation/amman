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
  MSG_REQUEST_ACCOUNT_SAVE,
  MSG_RESPOND_ACCOUNT_SAVE,
  MSG_REQUEST_SNAPSHOT_SAVE,
  MSG_RESPOND_SNAPSHOT_SAVE,
  MSG_REQUEST_STORE_KEYPAIR,
  MSG_RESPOND_STORE_KEYPAIR,
  MSG_REQUEST_LOAD_KEYPAIR,
  MSG_RESPOND_LOAD_KEYPAIR,
  AmmanAccountRendererMap,
  MSG_REQUEST_SET_ACCOUNT,
  MSG_RESPOND_SET_ACCOUNT,
  PersistedAccountInfo,
  MSG_REQUEST_LOAD_SNAPSHOT,
  MSG_RESPOND_LOAD_SNAPSHOT,
  MSG_REQUEST_VALIDATOR_PID,
  MSG_RESPOND_VALIDATOR_PID,
} from '@metaplex-foundation/amman-client'
import { AccountInfo, Keypair } from '@solana/web3.js'
import { createServer, Server as HttpServer } from 'http'
import { AddressInfo } from 'net'
import { Server, Socket } from 'socket.io'
import { AccountProvider } from '../accounts/providers'
import { AccountStates } from '../accounts/state'
import { AccountPersister } from '../assets'
import { AmmanAccountProvider } from '../types'
import { scopedLog } from '../utils'
import { killRunningServer } from '../utils/http'
import { Account, AmmanState, Program } from '../validator/types'
import { RelayHandler } from './handler'
import { RestServer } from './rest'
import { AMMAN_VERSION } from './types'

const { logDebug, logTrace } = scopedLog('relay')

/**
 * A simple socket.io server which communicates to the Amman Explorere as well as accepting connections
 * from other clients, i.e. via an {@link AmmanClient} which tests can use to communicate via the amman API.
 *
 * @private
 */
export /* internal */ class RelayServer {
  constructor(readonly io: Server, readonly handler: RelayHandler) {
    this.hookConnectionEvents()
  }

  get accountStates() {
    return this.handler.accountStates
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
    // TODO(thlorenz): After merge add method to request pid and restart validator
    const subscribedAccountStates = new Set<string>()
    socket
      // -----------------
      // Amman Version
      // -----------------
      .on(MSG_REQUEST_AMMAN_VERSION, () => {
        logTrace(MSG_REQUEST_AMMAN_VERSION)
        socket.emit(MSG_RESPOND_AMMAN_VERSION, AMMAN_VERSION)
      })
      // -----------------
      // Validator Pid
      // -----------------
      .on(MSG_REQUEST_VALIDATOR_PID, () => {
        logTrace(MSG_REQUEST_VALIDATOR_PID)
        const reply = this.handler.requestValidatorPid()
        socket.emit(MSG_RESPOND_VALIDATOR_PID, reply)
      })
      // -----------------
      // Address Labels
      // -----------------
      .on(MSG_UPDATE_ADDRESS_LABELS, (labels: Record<string, string>) => {
        if (logTrace.enabled) {
          logTrace(MSG_UPDATE_ADDRESS_LABELS)
          const labelCount = Object.keys(labels).length
          logTrace(`Got ${labelCount} labels, broadcasting ...`)
        }
        this.handler.updateAddressLabels(labels)
        socket.broadcast.emit(MSG_UPDATE_ADDRESS_LABELS, labels)
        socket.emit(ACK_UPDATE_ADDRESS_LABELS)
      })
      .on(MSG_GET_KNOWN_ADDRESS_LABELS, () => {
        if (logTrace.enabled) {
          logTrace(MSG_GET_KNOWN_ADDRESS_LABELS)
          const labelCount = Object.keys(this.handler.allKnownLabels).length
          logTrace(`Sending ${labelCount} known labels to requesting client.`)
        }
        socket.emit(MSG_UPDATE_ADDRESS_LABELS, this.handler.allKnownLabels)
      })
      // -----------------
      // Account States
      // -----------------
      .on(MSG_REQUEST_ACCOUNT_STATES, (pubkeyArg: string) => {
        logTrace(MSG_REQUEST_ACCOUNT_STATES, pubkeyArg)
        const [pubkey, states] = this.handler.requestAccountStates(pubkeyArg)

        socket.emit(MSG_RESPOND_ACCOUNT_STATES, pubkey, states ?? [])
        if (!subscribedAccountStates.has(pubkey)) {
          subscribedAccountStates.add(pubkey)
          this.handler.accountStates.on(
            `account-changed:${pubkey}`,
            (states) => {
              socket.emit(MSG_UPDATE_ACCOUNT_STATES, pubkey, states)
              logTrace(MSG_UPDATE_ACCOUNT_STATES)
            }
          )
        }
      })
      // -----------------
      // Save Account
      // -----------------
      .on(
        MSG_REQUEST_ACCOUNT_SAVE,
        async (pubkeyArg: string, slot?: number) => {
          logTrace(MSG_REQUEST_ACCOUNT_SAVE, pubkeyArg)
          const [pubkey, result] = await this.handler.requestAccountSave(
            pubkeyArg,
            slot
          )
          socket.emit(MSG_RESPOND_ACCOUNT_SAVE, pubkey, result)
        }
      )
      // -----------------
      // Snapshot
      // -----------------
      .on(MSG_REQUEST_SNAPSHOT_SAVE, async (label: string) => {
        logTrace(MSG_REQUEST_SNAPSHOT_SAVE, label)
        const result = this.handler.requestSnapshotSave(label)
        socket.emit(MSG_RESPOND_SNAPSHOT_SAVE, result)
      })
      .on(MSG_REQUEST_LOAD_SNAPSHOT, async (label: string) => {
        logTrace(MSG_REQUEST_LOAD_SNAPSHOT, label)
        const reply = await this.handler.requestLoadSnapshot(label)
        socket.emit(MSG_RESPOND_LOAD_SNAPSHOT, reply)
      })
      // -----------------
      // Keypair
      // -----------------
      .on(MSG_REQUEST_STORE_KEYPAIR, (id: string, secretKey: Uint8Array) => {
        logTrace(MSG_REQUEST_STORE_KEYPAIR, id)
        const reply = this.handler.requestStoreKeypair(id, secretKey)
        socket.emit(MSG_RESPOND_STORE_KEYPAIR, reply)
      })
      .on(MSG_REQUEST_LOAD_KEYPAIR, (idArg: string) => {
        logTrace(MSG_REQUEST_LOAD_KEYPAIR, idArg)
        const [id, keypair] = this.handler.requestLoadKeypair(idArg)
        socket.emit(MSG_RESPOND_LOAD_KEYPAIR, [id, keypair])
      })
      // -----------------
      // Set Account
      // -----------------
      .on(MSG_REQUEST_SET_ACCOUNT, async (account: PersistedAccountInfo) => {
        logTrace(MSG_REQUEST_SET_ACCOUNT)
        const reply = await this.handler.requestSetAccount(account)
        socket.emit(MSG_RESPOND_SET_ACCOUNT, reply)
      })
  }
}

/**
 * Sets up the Amman Relay which uses the given account provider to resolve account data.
 * @private
 * */
export class Relay {
  private static createApp(handler: RelayHandler) {
    const server = createServer()
    const io = new Server(server, {
      cors: {
        origin: '*',
      },
    })
    const relayServer = new RelayServer(io, handler)
    return { app: server, io, relayServer }
  }

  static async startServer(
    ammanState: AmmanState,
    accountProviders: Record<string, AmmanAccountProvider>,
    accountRenderers: AmmanAccountRendererMap,
    programs: Program[],
    accounts: Account[],
    loadedAccountInfos: Map<string, AccountInfo<Buffer>>,
    loadedKeypairs: Map<string, Keypair>,
    accountsFolder: string,
    snapshotRoot: string,
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
    AccountStates.createInstance(
      accountProvider.connection,
      accountProvider,
      loadedAccountInfos,
      loadedKeypairs
    )
    const accountPersister = new AccountPersister(
      accountsFolder,
      accountProvider.connection
    )
    const snapshotPersister = new AccountPersister(
      snapshotRoot,
      accountProvider.connection
    )

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

    const handler = new RelayHandler(
      accountProvider,
      accountPersister,
      snapshotPersister,
      ammanState,
      AccountStates.instance,
      knownLabels
    )
    const { app, io, relayServer } = Relay.createApp(handler)
    RestServer.init(app, handler)

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
