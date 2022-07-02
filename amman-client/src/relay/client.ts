import { Keypair } from '@solana/web3.js'
import { strict as assert } from 'assert'
import io, { Socket } from 'socket.io-client'
import { PersistedAccountInfo } from '../assets/persistence'
import { isBrowser } from '../utils/browser'
import { scopedLog } from '../utils/log'
import {
  ACK_UPDATE_ADDRESS_LABELS,
  AMMAN_RELAY_URI,
  MSG_CLEAR_ADDRESS_LABELS,
  MSG_CLEAR_TRANSACTIONS,
  MSG_GET_KNOWN_ADDRESS_LABELS,
  MSG_REQUEST_ACCOUNT_SAVE,
  MSG_REQUEST_ACCOUNT_STATES,
  MSG_REQUEST_LOAD_KEYPAIR,
  MSG_REQUEST_LOAD_SNAPSHOT,
  MSG_REQUEST_RESTART_VALIDATOR,
  MSG_REQUEST_SET_ACCOUNT,
  MSG_REQUEST_SNAPSHOT_SAVE,
  MSG_REQUEST_STORE_KEYPAIR,
  MSG_RESPOND_ACCOUNT_SAVE,
  MSG_RESPOND_ACCOUNT_STATES,
  MSG_RESPOND_LOAD_KEYPAIR,
  MSG_RESPOND_LOAD_SNAPSHOT,
  MSG_RESPOND_RESTART_VALIDATOR,
  MSG_RESPOND_SET_ACCOUNT,
  MSG_RESPOND_SNAPSHOT_SAVE,
  MSG_RESPOND_STORE_KEYPAIR,
  MSG_UPDATE_ADDRESS_LABELS,
} from './consts'
import { createTimeout } from './timeout'
import { RelayAccountState } from './types'

const { logError, logDebug, logTrace } = scopedLog('relay')

/** @private */
export type AmmanClient = {
  clearAddressLabels(): void
  clearTransactions(): void
  addAddressLabels(labels: Record<string, string>): Promise<void>
  fetchAddressLabels(): Promise<Record<string, string>>
  fetchAccountStates(address: string): Promise<RelayAccountState[]>
  requestSnapshot(label?: string): Promise<string>
  requestLoadSnapshot(label: string): Promise<void>
  requestSaveAccount(address: string): Promise<string>
  requestStoreKeypair(label: string, keypair: Keypair): Promise<void>
  requestLoadKeypair(id: string): Promise<Keypair | undefined>
  requestSetAccount(persistedAccountInfo: PersistedAccountInfo): Promise<void>
  requestRestartValidator(): Promise<void>
  disconnect(): void
  destroy(): void
}

export type AmmanClientOpts = { autoUnref?: boolean; ack?: boolean }

const RELAY_TIMEOUT_MS: number = 2000

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
  private _reqId = 0
  private constructor(readonly url: string, opts: AmmanClientOpts = {}) {
    const { autoUnref = !isBrowser, ack = false } = opts
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
          new Error('Unable to add address labels' + AMMAN_NOT_RUNNING_ERROR),
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
    return this._handleRequest<Record<string, string>>(
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
    return this._handleRequest<RelayAccountState[]>(
      `fetch account states for ${address}`,
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
    label ??= new Date().toJSON().replace(/[:.]/g, '_')

    return this._handleRequest<string>(
      'request snapshot accounts',
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

  async requestLoadSnapshot(label: string): Promise<void> {
    return this._handleRequest<void>(
      'request load snapshot',
      MSG_REQUEST_LOAD_SNAPSHOT,
      [label],
      MSG_RESPOND_LOAD_SNAPSHOT,
      (resolve, reject, err) => {
        if (err != null) return reject(new Error(err))
        resolve()
      },
      5000
    )
  }

  async requestSaveAccount(address: string): Promise<string> {
    return this._handleRequest<string>(
      `save account ${address}`,
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
    const key = keypair.publicKey.toBase58()
    const taskSuffix = id === key ? `"${id}"` : `"${id}" (${key})`

    return this._handleRequest<void>(
      `store keypair ${taskSuffix}`,
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
    return this._handleRequest<Keypair | undefined>(
      `load keypair ${id}`,
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

  requestSetAccount(persistedAccountInfo: PersistedAccountInfo) {
    return this._handleRequest(
      'set account',
      MSG_REQUEST_SET_ACCOUNT,
      [persistedAccountInfo],
      MSG_RESPOND_SET_ACCOUNT,
      (resolve, _reject) => {
        resolve()
      },
      5000
    )
  }

  requestRestartValidator(): Promise<void> {
    return this._handleRequest(
      '',
      MSG_REQUEST_RESTART_VALIDATOR,
      [],
      MSG_RESPOND_RESTART_VALIDATOR,
      (resolve, _reject) => {
        resolve()
      },
      5000
    )
  }

  private _handleRequest<T = void>(
    action: string,
    request: string,
    requestArgs: any[],
    response: string,
    responseHandler: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: any) => void,
      ...args: any[]
    ) => Promise<void> | void,
    timeoutMs = RELAY_TIMEOUT_MS
  ) {
    return new Promise<T>((resolve, reject) => {
      const reqId = this._reqId++
      const onResponse = (...args: any[]) => {
        logTrace('<- [%s][%d]', action, reqId)
        clearTimeout(timeout)
        responseHandler(resolve, reject, ...args)
        this.socket.off(response, onResponse)
      }
      const timeout = createTimeout(
        timeoutMs,
        new Error(`Unable to ${action}. ${AMMAN_NOT_RUNNING_ERROR}`),
        (reason: any) => {
          logError(`'${request}' timed out`)
          reject(reason)
        }
      )
      this.socket
        .on('error', (err: any) => {
          clearTimeout(timeout)
          reject(err)
        })
        .on(response, onResponse)
        .emit(request, ...requestArgs)

      logTrace('-> [%s][%d]', action, reqId)
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
  clearAddressLabels(): void { }
  clearTransactions(): void { }
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
  requestLoadSnapshot(_label: string): Promise<void> {
    return Promise.resolve()
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
  requestSetAccount(_persistedAccountInfo: PersistedAccountInfo) {
    return Promise.resolve()
  }
  requestRestartValidator(): Promise<void> {
    return Promise.resolve()
  }
  disconnect() { }
  destroy() { }
}
