import { Keypair } from '@solana/web3.js'
import { strict as assert } from 'assert'
import io, { Socket } from 'socket.io-client'
import { logDebug, logError, logTrace } from '../utils/log'
import {
  ACK_UPDATE_ADDRESS_LABELS,
  AMMAN_RELAY_URI,
  MSG_CLEAR_ADDRESS_LABELS,
  MSG_CLEAR_TRANSACTIONS,
  MSG_GET_KNOWN_ADDRESS_LABELS,
  MSG_REQUEST_ACCOUNT_SAVE,
  MSG_REQUEST_ACCOUNT_STATES,
  MSG_REQUEST_LOAD_KEYPAIR,
  MSG_REQUEST_SNAPSHOT_SAVE,
  MSG_REQUEST_STORE_KEYPAIR,
  MSG_RESPOND_ACCOUNT_SAVE,
  MSG_RESPOND_ACCOUNT_STATES,
  MSG_RESPOND_LOAD_KEYPAIR,
  MSG_RESPOND_SNAPSHOT_SAVE,
  MSG_RESPOND_STORE_KEYPAIR,
  MSG_UPDATE_ADDRESS_LABELS,
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
  requestLoadKeypair(id: string): Promise<Keypair | undefined>
  disconnect(): void
  destroy(): void
}

export type AmmanClientOpts = { autoUnref?: boolean; ack?: boolean }

const RELAY_TIMEOUT: number = 2000

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
    return this.ack
      ? this._registerRequestHandler<void>(
          'add address labels',
          MSG_UPDATE_ADDRESS_LABELS,
          [labels],
          ACK_UPDATE_ADDRESS_LABELS,
          (resolve, _reject) => {
            logTrace('Got ack for address labels update %O', labels)
            resolve()
          }
        )
      : Promise.resolve()
  }

  async fetchAddressLabels(): Promise<Record<string, string>> {
    logTrace('Fetching address labels')

    return this._registerRequestHandler<Record<string, string>>(
      'fetch address labels',
      MSG_GET_KNOWN_ADDRESS_LABELS,
      [],
      MSG_UPDATE_ADDRESS_LABELS,
      (resolve, _reject, labels: Record<string, string>) => {
        logTrace('Got address labels %O', labels)
        resolve(labels)
      }
    )
  }

  async fetchAccountStates(address: string) {
    logTrace('Fetching account states for %s', address)

    return this._registerRequestHandler<RelayAccountState[]>(
      'fetch account states',
      MSG_REQUEST_ACCOUNT_STATES,
      [address],
      MSG_RESPOND_ACCOUNT_STATES,
      (
        resolve,
        _reject,
        accountAddress: string,
        states: RelayAccountState[]
      ) => {
        logDebug(
          'Got account states for address %s, %O',
          accountAddress,
          states
        )
        resolve(states)
      }
    )
  }

  async requestSnapshot(label?: string): Promise<string> {
    logTrace('Requesting snapshot')
    label ??= new Date().toJSON().replace(/[:.]/g, '_')

    return this._registerRequestHandler<string>(
      'snapshot accounts',
      MSG_REQUEST_SNAPSHOT_SAVE,
      [label],
      MSG_RESPOND_SNAPSHOT_SAVE,
      (
        resolve,
        reject,
        { err, snapshotDir }: { err?: string; snapshotDir?: string }
      ) => {
        if (err != null) return reject(new Error(err))
        assert(snapshotDir != null, 'expected either error or snapshotDir')
        logDebug('Completed snapshot at %s', snapshotDir)
        resolve(snapshotDir)
      }
    )
  }

  async requestSaveAccount(address: string): Promise<string> {
    logTrace('Requesting to save account "%s"', address)
    return this._registerRequestHandler<string>(
      'save account',
      MSG_REQUEST_ACCOUNT_SAVE,
      [address],
      MSG_RESPOND_ACCOUNT_SAVE,
      (
        resolve,
        reject,
        { err, accountPath }: { err?: string; accountPath?: string }
      ) => {
        if (err != null) return reject(new Error(err))
        assert(accountPath != null, 'expected either error or accountPath')
        logDebug('Completed saving account at %s', accountPath)
        resolve(accountPath)
      }
    )
  }

  async requestStoreKeypair(id: string, keypair: Keypair): Promise<void> {
    logTrace(
      'Requesting to store keypair "%s" (%s)',
      id,
      keypair.publicKey.toBuffer()
    )
    return this._registerRequestHandler<void>(
      'store keypair',
      MSG_REQUEST_STORE_KEYPAIR,
      [id, keypair.secretKey],
      MSG_RESPOND_STORE_KEYPAIR,
      (resolve, reject, err?: any) => {
        if (err != null) return reject(new Error(err))
        resolve()
      }
    )
  }

  async requestLoadKeypair(id: string): Promise<Keypair | undefined> {
    logTrace('Requesting to load keypair with id "%s"', id)
    return this._registerRequestHandler<Keypair | undefined>(
      'load keypair',
      MSG_REQUEST_LOAD_KEYPAIR,
      [id],
      MSG_RESPOND_LOAD_KEYPAIR,
      (resolve, _reject, secretKey: Uint8Array | undefined) => {
        try {
          resolve(
            secretKey != null ? Keypair.fromSecretKey(secretKey) : undefined
          )
        } catch (err) {
          logError('Failed to load keypair with id "%s"', id)
          logError(err)
          resolve(undefined)
        }
      }
    )
  }

  private _registerRequestHandler<T = void>(
    action: string,
    request: string,
    requestArgs: any[],
    response: string,
    responseHandler: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: any) => void,
      ...args: any[]
    ) => Promise<void> | void
  ) {
    return new Promise<T>((resolve, reject) => {
      const timeout = createTimeout(
        RELAY_TIMEOUT,
        new Error(`Unable to ${action}. ${AMMAN_NOT_RUNNING_ERROR}`),
        reject
      )
      this.socket
        .on('error', (err: any) => {
          clearTimeout(timeout)
          reject(err)
        })
        .on(response, (...args: any[]) => {
          clearTimeout(timeout)
          responseHandler(resolve, reject, ...args)
        })
        .emit(request, ...requestArgs)
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

  requestLoadKeypair(_id: string): Promise<Keypair | undefined> {
    return Promise.resolve(undefined)
  }
  disconnect() {}
  destroy() {}
}
