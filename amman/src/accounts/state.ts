import {
  AccountDiff,
  isKeyLike,
  publicKeyString,
} from '@metaplex-foundation/amman-client'
import {
  AccountInfo,
  Connection,
  Context,
  Keypair,
  Logs,
  PublicKey,
} from '@solana/web3.js'
import { strict as assert } from 'assert'
import BN from 'bn.js'
import { diff } from 'deep-diff'
import * as Diff from 'diff'
import EventEmitter from 'events'
import { AmmanAccount } from '../types'
import { logDebug } from '../utils/log'
import { AccountProvider } from './providers'

export type { Change } from 'diff'

export type AccountState = {
  account: AmmanAccount | undefined
  slot: number
  data: Buffer
  accountDiff?: AccountDiff
  rendered?: string
  renderedDiff?: Diff.Change[]
}

class AccountStateTracker {
  readonly states: (AccountState & { timestamp: number })[] = []

  add(state: AccountState) {
    const lastState =
      this.states.length > 0 ? this.states[this.states.length - 1] : null
    const accountDiff: AccountDiff | undefined =
      lastState == null || lastState.account == null || state.account == null
        ? undefined
        : diff(lastState.account.pretty(), state.account.pretty())
    const processedState = {
      ...state,
      accountDiff,
      timestamp: Date.now().valueOf(),
    }
    const renderedDiff = this.renderDiff(lastState, state)
    if (renderedDiff != null) {
      processedState.renderedDiff = renderedDiff
    }
    this.states.push(processedState)
  }

  get relayStates() {
    return this.states
      .filter((state) => state.account != null)
      .map(({ account, data, ...rest }) => ({
        account: account!.pretty(),
        ...rest,
      }))
  }

  renderDiff(lastState: AccountState | null, state: AccountState) {
    if (lastState?.rendered == null) return undefined
    if (state.rendered == null) return undefined
    return Diff.diffChars(lastState.rendered, state.rendered)
  }

  accountStateForSlot(slot: number) {
    return this.states.find((state) => state.slot === slot)
  }

  accountDataForSlot(slot: number) {
    return this.accountStateForSlot(slot)?.data
  }
}

export class AccountStates extends EventEmitter {
  readonly states: Map<string, AccountStateTracker> = new Map()
  readonly keypairs: Map<string, { keypair: Keypair; id: string }> = new Map()

  private _paused = false

  get paused() {
    return this._paused
  }

  set paused(val: boolean) {
    this._paused = val
  }

  private constructor(
    readonly connection: Connection,
    readonly accountProvider: AccountProvider,
    readonly loadedAccountInfos: Map<string, AccountInfo<Buffer>>,
    // label:Keypair
    readonly loadedKeypairs: Map<string, Keypair>
  ) {
    super()
    this.connection.onLogs('all', this._onLog, 'confirmed')
    for (const [address, info] of this.loadedAccountInfos) {
      this.update(address, 0, info)
    }
    for (const [label, keypair] of this.loadedKeypairs) {
      this.keypairs.set(keypair.publicKey.toBase58(), { keypair, id: label })
    }
  }

  // -----------------
  // Account States
  // -----------------
  async update(
    address: string,
    slot: number,
    accountInfo?: AccountInfo<Buffer>
  ) {
    if (!this.states.has(address)) {
      this.states.set(address, new AccountStateTracker())
    }

    const res = await this.accountProvider.tryResolveAccount(
      new PublicKey(address),
      accountInfo
    )
    if (res == null) return

    this.add(address, { ...res, slot })
    const states = this.get(address)?.relayStates
    this.emit(`account-changed:${address}`, states)
  }

  add(address: string, state: AccountState) {
    const states = this.get(address)
    assert(states != null, 'expected states to be set before adding')
    states.add(state)
  }

  get(address: string): AccountStateTracker | undefined {
    return this.states.get(address)
  }

  accountStateForSlot(address: string, slot: number) {
    return this.get(address)?.accountStateForSlot(slot)
  }

  accountDataForSlot(address: string, slot: number): Buffer | undefined {
    return this.get(address)?.accountDataForSlot(slot)
  }

  allAccountAddresses() {
    return Array.from(this.states.keys())
  }

  // -----------------
  // Keypairs
  // -----------------
  storeKeypair(id: string, keypair: Keypair) {
    this.keypairs.set(keypair.publicKey.toBase58(), { keypair, id })
  }

  labelKeypairs(
    // Keyed pubkey:label
    labels: Record<string, string>
  ) {
    for (const [key, label] of Object.entries(labels)) {
      const entry = this.keypairs.get(key)
      if (entry == null) continue
      this.keypairs.set(key, { keypair: entry.keypair, id: label })
    }
  }

  get allKeypairs() {
    return this.keypairs
  }

  getKeypairById(keypairId: string) {
    for (const { keypair, id } of this.keypairs.values()) {
      if (id === keypairId) return keypair
    }
  }

  getKeypairByAddress(address: string) {
    return this.keypairs.get(address)?.keypair
  }

  private _onLog = async (logs: Logs, ctx: Context) => {
    if (this._paused) return

    const tx = await this.connection.getTransaction(logs.signature, {
      commitment: 'confirmed',
    })
    if (tx == null) {
      logDebug(`Could not find transaction ${logs.signature}`)
      return
    }
    const nonProgramAddresses = tx.transaction.message
      .nonProgramIds()
      .map((x) => x.toBase58())

    for (const key of nonProgramAddresses) {
      if (this._paused) return
      this.update(key, ctx.slot)
    }
  }

  private static _instance: AccountStates | null = null
  static get instance() {
    assert(AccountStates._instance != null, 'expected AccountStates instance')
    return AccountStates._instance
  }

  static createInstance(
    connection: Connection,
    accountProvider: AccountProvider,
    loadedAccountInfos: Map<string, AccountInfo<Buffer>>,
    loadedKeypairs: Map<string, Keypair>
  ) {
    AccountStates._instance = new AccountStates(
      connection,
      accountProvider,
      loadedAccountInfos,
      loadedKeypairs
    )
    return AccountStates._instance
  }
}

export function printableAccount(
  account: Record<string, any>
): Record<string, any> {
  const prettified: Record<string, any> = {}
  for (const [key, val] of Object.entries(account)) {
    if (val == null) continue
    if (typeof (val as unknown as AmmanAccount).pretty === 'function') {
      prettified[key] = (val as unknown as AmmanAccount).pretty()
    }
    if (
      BN.isBN(val) ||
      (typeof val === 'object' &&
        'negative' in val &&
        'words' in val &&
        'red' in val)
    ) {
      prettified[key] = new BN(val).toNumber()
    } else if (isKeyLike(val)) {
      prettified[key] = publicKeyString(val)
    } else if (Array.isArray(val)) {
      prettified[key] = val.map((val) => JSON.stringify(printableAccount(val)))
    } else if (typeof val === 'object') {
      prettified[key] = JSON.stringify(printableAccount(val), null, 2)
    } else {
      prettified[key] = val
    }
  }
  return prettified
}
