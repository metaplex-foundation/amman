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
} from '@metaplex-foundation/amman-client'
import { AccountInfo, Keypair, PublicKey } from '@solana/web3.js'
import { createServer, Server as HttpServer } from 'http'
import { AddressInfo } from 'net'
import { Server, Socket } from 'socket.io'
import { AccountProvider } from '../accounts/providers'
import { AccountStates } from '../accounts/state'
import { AccountPersister } from '../assets'
import { AmmanAccountProvider } from '../types'
import { scopedLog } from '../utils'
import { killRunningServer } from '../utils/http'
import { restartValidator } from '../validator'
import { Account, AmmanState, Program } from '../validator/types'
import { AMMAN_VERSION } from './types'

const { logError, logDebug, logTrace } = scopedLog('relay')

/**
 * A simple socket.io server which communicates to the Amman Explorere as well as accepting connections
 * from other clients, i.e. via an {@link AmmanClient} which tests can use to communicate via the amman API.
 *
 * @private
 */
class RelayServer {
  constructor(
    readonly io: Server,
    readonly ammanState: AmmanState,
    readonly accountProvider: AccountProvider,
    readonly accountPersister: AccountPersister,
    readonly snapshotPersister: AccountPersister,
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
          logTrace(MSG_UPDATE_ADDRESS_LABELS)
          const labelCount = Object.keys(labels).length
          logTrace(`Got ${labelCount} labels, broadcasting ...`)
        }
        for (const [key, val] of Object.entries(labels)) {
          this.allKnownLabels[key] = val
        }
        this.accountStates.labelKeypairs(this.allKnownLabels)
        socket.broadcast.emit(MSG_UPDATE_ADDRESS_LABELS, labels)
        socket.emit(ACK_UPDATE_ADDRESS_LABELS)
      })
      .on(MSG_GET_KNOWN_ADDRESS_LABELS, () => {
        if (logTrace.enabled) {
          logTrace(MSG_GET_KNOWN_ADDRESS_LABELS)
          const labelCount = Object.keys(this.allKnownLabels).length
          logTrace(`Sending ${labelCount} known labels to requesting client.`)
        }
        socket.emit(MSG_UPDATE_ADDRESS_LABELS, this.allKnownLabels)
      })
      .on(MSG_REQUEST_ACCOUNT_STATES, (pubkey: string) => {
        logTrace(MSG_REQUEST_ACCOUNT_STATES, pubkey)
        const states = this.accountStates.get(pubkey)?.relayStates
        socket.emit(MSG_RESPOND_ACCOUNT_STATES, pubkey, states ?? [])
        if (!subscribedAccountStates.has(pubkey)) {
          subscribedAccountStates.add(pubkey)
          this.accountStates.on(`account-changed:${pubkey}`, (states) => {
            socket.emit(MSG_UPDATE_ACCOUNT_STATES, pubkey, states)
            logTrace(MSG_UPDATE_ACCOUNT_STATES)
          })
        }
      })
      .on(MSG_REQUEST_ACCOUNT_SAVE, async (pubkey: string, slot?: number) => {
        logTrace(MSG_REQUEST_ACCOUNT_SAVE, pubkey)
        try {
          let data
          if (slot != null) {
            data = this.accountStates.accountDataForSlot(pubkey, slot)
          }
          const accountPath = await this.accountPersister.saveAccount(
            new PublicKey(pubkey),
            this.accountProvider.connection,
            data
          )
          socket.emit(MSG_RESPOND_ACCOUNT_SAVE, pubkey, { accountPath })
        } catch (err) {
          socket.emit(MSG_RESPOND_ACCOUNT_SAVE, pubkey, { err })
        }
      })
      .on(MSG_REQUEST_SNAPSHOT_SAVE, async (label: string) => {
        logTrace(MSG_REQUEST_SNAPSHOT_SAVE, label)
        try {
          const addresses = this.accountStates.allAccountAddresses()
          const snapshotDir = await this.snapshotPersister.snapshot(
            label,
            addresses,
            this.allKnownLabels,
            this.accountStates.allKeypairs
          )
          socket.emit(MSG_RESPOND_SNAPSHOT_SAVE, { snapshotDir })
        } catch (err: any) {
          socket.emit(MSG_RESPOND_SNAPSHOT_SAVE, { err: err.toString() })
        }
      })
      .on(MSG_REQUEST_STORE_KEYPAIR, (id: string, secretKey: Uint8Array) => {
        logTrace(MSG_REQUEST_STORE_KEYPAIR, id)
        try {
          const keypair = Keypair.fromSecretKey(secretKey)
          this.accountStates.storeKeypair(id, keypair)
          socket.emit(MSG_RESPOND_STORE_KEYPAIR)
          logTrace(MSG_RESPOND_STORE_KEYPAIR)
        } catch (err: any) {
          logError(err)
          socket.emit(MSG_RESPOND_STORE_KEYPAIR, err.toString())
        }
      })
      .on(MSG_REQUEST_LOAD_KEYPAIR, (id: string) => {
        logTrace(MSG_REQUEST_LOAD_KEYPAIR, id)
        const keypair = this.accountStates.getKeypairById(id)
        socket.emit(MSG_RESPOND_LOAD_KEYPAIR, keypair?.secretKey)
      })
      .on(MSG_REQUEST_SET_ACCOUNT, async (account: PersistedAccountInfo) => {
        logTrace(MSG_REQUEST_SET_ACCOUNT)
        const addresses = this.accountStates.allAccountAddresses()
        await restartValidator(
          this.ammanState,
          addresses,
          this.allKnownLabels,
          this.accountStates.allKeypairs,
          new Map([[account.pubkey, account]])
        )
        socket.emit(MSG_RESPOND_SET_ACCOUNT)
      })
      .on(MSG_REQUEST_AMMAN_VERSION, () => {
        logTrace(MSG_REQUEST_AMMAN_VERSION)
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
    ammanState: AmmanState,
    accountProvider: AccountProvider,
    accountPersister: AccountPersister,
    snapshotPersister: AccountPersister,
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
      ammanState,
      accountProvider,
      accountPersister,
      snapshotPersister,
      accountStates,
      knownLabels
    )
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

    const { app, io, relayServer } = Relay.createApp(
      ammanState,
      accountProvider,
      accountPersister,
      snapshotPersister,
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
