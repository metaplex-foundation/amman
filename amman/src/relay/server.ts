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
  MSG_REQUEST_RESTART_VALIDATOR,
  MSG_RESPOND_RESTART_VALIDATOR,
  MSG_RESPOND_KILL_AMMAN,
  MSG_REQUEST_KILL_AMMAN,
  isReplyWithResult,
  RelayReply,
  AddressLabelsResult,
} from '@metaplex-foundation/amman-client'
import { AccountInfo, Keypair } from '@solana/web3.js'
import { createServer, Server as HttpServer } from 'http'
import { AddressInfo } from 'net'
import { Server, Socket } from 'socket.io'
import { AccountProvider } from '../accounts/providers'
import { AccountStates } from '../accounts/state'
import { AccountPersister } from '../assets'
import { AmmanAccountProvider } from '../types'
import { logError, scopedLog } from '../utils'
import { killRunningServer } from '../utils/http'
import { Account, AmmanState, Program } from '../validator/types'
import { RelayHandler } from './handler'
import { RestServer } from './rest-server'

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
    const subscribedAccountStates = new Set<string>()
    socket
      // -----------------
      // Amman Version
      // -----------------
      .on(MSG_REQUEST_AMMAN_VERSION, () => {
        logTrace(MSG_REQUEST_AMMAN_VERSION)
        const reply = this.handler.requestAmmanVersion()
        socket.emit(MSG_RESPOND_AMMAN_VERSION, reply)
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
      // Kill Amman
      // -----------------
      .on(MSG_REQUEST_KILL_AMMAN, async () => {
        logTrace(MSG_REQUEST_KILL_AMMAN)
        const reply = await this.handler.requestKillAmman()
        socket.emit(MSG_RESPOND_KILL_AMMAN, reply)
      })
      // -----------------
      // Address Labels
      // -----------------
      .on(
        MSG_UPDATE_ADDRESS_LABELS,
        (reply: RelayReply<AddressLabelsResult>) => {
          if (logTrace.enabled) {
            logTrace(MSG_UPDATE_ADDRESS_LABELS)
            if (isReplyWithResult(reply)) {
              const labelCount = Object.keys(reply.result.labels).length
              logTrace(`Got ${labelCount} labels, broadcasting ...`)
            } else {
              logError(reply.err)
            }
          }
          if (isReplyWithResult(reply)) {
            this.handler.updateAddressLabels(reply.result.labels)
          }

          socket.broadcast.emit(MSG_UPDATE_ADDRESS_LABELS, reply)
          socket.emit(ACK_UPDATE_ADDRESS_LABELS)
        }
      )
      .on(MSG_GET_KNOWN_ADDRESS_LABELS, () => {
        if (logTrace.enabled) {
          logTrace(MSG_GET_KNOWN_ADDRESS_LABELS)
          const labelCount = Object.keys(this.handler.allKnownLabels).length
          logTrace(`Sending ${labelCount} known labels to requesting client.`)
        }
        const reply: RelayReply<AddressLabelsResult> = {
          result: { labels: this.handler.allKnownLabels },
        }
        socket.emit(MSG_UPDATE_ADDRESS_LABELS, reply)
      })
      // -----------------
      // Restart Validator
      // -----------------
      .on(MSG_REQUEST_RESTART_VALIDATOR, async (label: string) => {
        logTrace(MSG_REQUEST_RESTART_VALIDATOR, label)
        const reply = await this.handler.requestRestartValidator()
        socket.emit(MSG_RESPOND_RESTART_VALIDATOR, reply)
      })
      // -----------------
      // Account States
      // -----------------
      .on(MSG_REQUEST_ACCOUNT_STATES, (pubkeyArg: string) => {
        logTrace(MSG_REQUEST_ACCOUNT_STATES, pubkeyArg)
        const reply = this.handler.requestAccountStates(pubkeyArg)

        if (isReplyWithResult(reply)) {
          const { pubkey } = reply.result
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
        }
        socket.emit(MSG_RESPOND_ACCOUNT_STATES, reply)
      })
      // -----------------
      // Save Account
      // -----------------
      .on(
        MSG_REQUEST_ACCOUNT_SAVE,
        async (pubkeyArg: string, slot?: number) => {
          logTrace(MSG_REQUEST_ACCOUNT_SAVE, pubkeyArg)
          const reply = await this.handler.requestAccountSave(pubkeyArg, slot)
          socket.emit(MSG_RESPOND_ACCOUNT_SAVE, reply)
        }
      )
      // -----------------
      // Snapshot
      // -----------------
      .on(MSG_REQUEST_SNAPSHOT_SAVE, async (label: string) => {
        logTrace(MSG_REQUEST_SNAPSHOT_SAVE, label)
        const reply = await this.handler.requestSnapshotSave(label)
        socket.emit(MSG_RESPOND_SNAPSHOT_SAVE, reply)
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
        const reply = this.handler.requestLoadKeypair(idArg)
        socket.emit(MSG_RESPOND_LOAD_KEYPAIR, reply)
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

  close() {
    return new Promise<void>((resolve, reject) =>
      this.io.close((err) => (err ? reject(err) : resolve()))
    )
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
