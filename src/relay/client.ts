import { Keypair } from '@solana/web3.js'
import { strict as assert } from 'assert'
import io, { Socket } from 'socket.io-client'
import { logDebug, logTrace } from '../utils'
import {
  ACK_UPDATE_ADDRESS_LABELS,
  MSG_CLEAR_ADDRESS_LABELS,
  MSG_CLEAR_TRANSACTIONS,
  MSG_UPDATE_ADDRESS_LABELS,
  AMMAN_RELAY_URI,
  MSG_GET_KNOWN_ADDRESS_LABELS,
  MSG_RESPOND_ACCOUNT_STATES,
  MSG_REQUEST_ACCOUNT_STATES,
  MSG_RESPOND_SNAPSHOT,
  MSG_REQUEST_SNAPSHOT,
  MSG_REQUEST_ACCOUNT_SAVE,
  MSG_RESPOND_ACCOUNT_SAVE,
  MSG_RESPOND_STORE_KEYPAIR,
  MSG_REQUEST_STORE_KEYPAIR,
} from './consts'
import { createTimeout } from './timeout'
import { RelayAccountState } from './types'

/** @private */
export type AmmanClient = {
  clearAddressLabels(): void
  clearTransactions(): void
  addAddressLabels(labels: Record<string, string>): Promise<void>
  fetchAddressLabels(): Promise<Record<string, string>>
  fetchAccountStates(address: string): Promise<RelayAccountState[]>
  requestSnapshot(label?: string): Promise<string>
  requestSaveAccount(address: string): Promise<string>
  requestStoreKeypair(label: string, keypair: Keypair): Promise<void>
  disconnect(): void
  destroy(): void
}

export type AmmanClientOpts = { autoUnref?: boolean; ack?: boolean }

const AMMAN_UNABLE_ADD_LABELS = 'Unable to connect to send address labels'
const AMMAN_UNABLE_FETCH_LABELS = 'Unable to connect to fetch address labels'
const AMMAN_UNABLE_FETCH_ACCOUNT_STATES =
  'Unable to connect to fetch account states'
const AMMAN_UNABLE_SNAPSHOT_ACCOUNTS = 'Unable to connect to snapshot accounts'
const AMMAN_UNABLE_SAVE_ACCOUNT = 'Unable to connect to save account'
const AMMAN_UNABLE_STORE_KEYPAIR = 'Unable to connect to store keypair'
const AMMAN_NOT_RUNNING_ERROR =
  ', is amman running with the relay enabled?\n' +
  'If not please start it as part of amman in a separate terminal via `amman start`\n' +
  'Make sure to set `relay: { enabled: true }` in `.ammanrc.js`.\n' +
  'Alternatively set environment var `CI=1` in your current terminal or\n' +
  'instantiate amman via `const amman = Amnnan.instance({ connectClient: false })`'

/** @private */
export class ConnectedAmmanClient implements AmmanClient {
  private readonly socket: Socket
  private readonly ack: boolean
  private constructor(readonly url: string, opts: AmmanClientOpts = {}) {
    const { autoUnref = true, ack = false } = opts
    this.ack = ack
    this.socket = io(url, { autoUnref })
  }
  private connect() {
    if (this.socket.connected) return this
    this.socket.connect()
    logDebug('AmmanClient connected')
    return this
  }

  clearAddressLabels() {
    // TODO(thlorenz): this should ack to resolve a promise
    this.socket.emit(MSG_CLEAR_ADDRESS_LABELS)
  }

  clearTransactions() {
    // TODO(thlorenz): this should ack to resolve a promise
    this.socket.emit(MSG_CLEAR_TRANSACTIONS)
  }

  addAddressLabels(labels: Record<string, string>): Promise<void> {
    if (logTrace.enabled) {
      const labelCount = Object.keys(labels).length
      logTrace(`Adding ${labelCount} address labels`)
    }
    const promise = this.ack
      ? new Promise<void>((resolve, reject) => {
          const timeout = createTimeout(
            2000,
            new Error(AMMAN_UNABLE_ADD_LABELS + AMMAN_NOT_RUNNING_ERROR),
            reject
          )
          this.socket
            .on('error', (err) => {
              clearTimeout(timeout)
              reject(err)
            })
            .on(ACK_UPDATE_ADDRESS_LABELS, () => {
              logTrace('Got ack for address labels update %O', labels)
              clearTimeout(timeout)
              resolve()
            })
        })
      : Promise.resolve()

    this.socket.emit(MSG_UPDATE_ADDRESS_LABELS, labels)
    return promise
  }

  async fetchAddressLabels(): Promise<Record<string, string>> {
    logTrace('Fetching address labels')
    return new Promise<Record<string, string>>((resolve, reject) => {
      const timeout = createTimeout(
        2000,
        new Error(AMMAN_UNABLE_FETCH_LABELS + AMMAN_NOT_RUNNING_ERROR),
        reject
      )
      this.socket
        .on('error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
        .on(MSG_UPDATE_ADDRESS_LABELS, (labels: Record<string, string>) => {
          clearTimeout(timeout)
          logTrace('Got address labels %O', labels)
          resolve(labels)
        })
        .emit(MSG_GET_KNOWN_ADDRESS_LABELS)
    })
  }

  async fetchAccountStates(address: string) {
    logTrace('Fetching account states for %s', address)
    return new Promise<RelayAccountState[]>((resolve, reject) => {
      const timeout = createTimeout(
        2000,
        new Error(AMMAN_UNABLE_FETCH_ACCOUNT_STATES + AMMAN_NOT_RUNNING_ERROR),
        reject
      )
      this.socket
        .on('error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
        .on(
          MSG_RESPOND_ACCOUNT_STATES,
          (accountAddress: string, states: RelayAccountState[]) => {
            clearTimeout(timeout)
            logDebug(
              'Got account states for address %s, %O',
              accountAddress,
              states
            )
            resolve(states)
          }
        )
        .emit(MSG_REQUEST_ACCOUNT_STATES, address)
    })
  }

  async requestSnapshot(label?: string): Promise<string> {
    logTrace('Requesting snapshot')
    label ??= new Date().toJSON().replace(/[:.]/g, '_')

    return new Promise<string>((resolve, reject) => {
      const timeout = createTimeout(
        2000,
        new Error(AMMAN_UNABLE_SNAPSHOT_ACCOUNTS + AMMAN_NOT_RUNNING_ERROR),
        reject
      )
      this.socket
        .on('error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
        .on(
          MSG_RESPOND_SNAPSHOT,
          ({ err, snapshotDir }: { err?: string; snapshotDir?: string }) => {
            clearTimeout(timeout)
            if (err != null) return reject(new Error(err))
            assert(snapshotDir != null, 'expected either error or snapshotDir')
            logDebug('Completed snapshot at %s', snapshotDir)
            resolve(snapshotDir)
          }
        )
        .emit(MSG_REQUEST_SNAPSHOT, label)
    })
  }

  async requestSaveAccount(address: string): Promise<string> {
    logTrace('Requesting to save account "%s"', address)

    return new Promise<string>((resolve, reject) => {
      const timeout = createTimeout(
        2000,
        new Error(AMMAN_UNABLE_SAVE_ACCOUNT + AMMAN_NOT_RUNNING_ERROR),
        reject
      )
      this.socket
        .on('error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
        .on(
          MSG_RESPOND_ACCOUNT_SAVE,
          ({ err, accountPath }: { err?: string; accountPath?: string }) => {
            clearTimeout(timeout)
            if (err != null) return reject(new Error(err))
            assert(accountPath != null, 'expected either error or accountPath')
            logDebug('Completed saving account at %s', accountPath)
            resolve(accountPath)
          }
        )
        .emit(MSG_REQUEST_ACCOUNT_SAVE, address)
    })
  }

  async requestStoreKeypair(id: string, keypair: Keypair): Promise<void> {
    logTrace(
      'Requesting to store keypair "%s" (%s)',
      id,
      keypair.publicKey.toBuffer()
    )
    return new Promise<void>((resolve, reject) => {
      const timeout = createTimeout(
        2000,
        new Error(AMMAN_UNABLE_STORE_KEYPAIR + AMMAN_NOT_RUNNING_ERROR),
        reject
      )
      this.socket
        .on('error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
        .on(MSG_RESPOND_STORE_KEYPAIR, (err?: any) => {
          clearTimeout(timeout)
          if (err != null) return reject(new Error(err))
          resolve()
        })
        .emit(MSG_REQUEST_STORE_KEYPAIR, id, keypair.secretKey)
    })
  }

  /**
   * Disconnects this client and allows the app to shut down.
   * Only needed if you set `{ autoUnref: false }` for the opts.
   */
  disconnect() {
    this.socket.disconnect()
  }

  /**
   * Disconnects this client preventing reconnects and allows the app to shut
   * down. Only needed if you set `{ autoUnref: false }` for the opts.
   */
  destroy() {
    // @ts-ignore it' private
    if (typeof this.socket.destroy === 'function') {
      // @ts-ignore it' private
      this.socket.destroy()
    }
  }

  private static _instance: ConnectedAmmanClient | undefined
  static getInstance(url?: string, ammanClientOpts?: AmmanClientOpts) {
    if (ConnectedAmmanClient._instance != null)
      return ConnectedAmmanClient._instance
    ConnectedAmmanClient._instance = new ConnectedAmmanClient(
      url ?? AMMAN_RELAY_URI,
      ammanClientOpts
    ).connect()
    return ConnectedAmmanClient._instance
  }
}

/** @private */
export class DisconnectedAmmanClient implements AmmanClient {
  clearAddressLabels(): void {}
  clearTransactions(): void {}
  addAddressLabels(_labels: Record<string, string>): Promise<void> {
    return Promise.resolve()
  }
  fetchAddressLabels(): Promise<Record<string, string>> {
    return Promise.resolve({})
  }
  fetchAccountStates(_address: string): Promise<RelayAccountState[]> {
    return Promise.resolve([])
  }
  requestSnapshot(_label?: string): Promise<string> {
    return Promise.resolve('')
  }
  requestSaveAccount(_address: string): Promise<string> {
    return Promise.resolve('')
  }
  requestStoreKeypair(_label: string, _keypair: Keypair): Promise<void> {
    return Promise.resolve()
  }
  disconnect() {}
  destroy() {}
}
