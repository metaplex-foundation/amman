import { Connection, Context, Logs, PublicKey } from '@solana/web3.js'
import { AmmanAccount } from '../types'
import { logDebug } from '../utils/log'
import { AccountProvider } from './providers'
import { strict as assert } from 'assert'
import { diff } from 'deep-diff'
import EventEmitter from 'events'
import { AccountDiff } from '../relay/types'

export type AccountState = {
  account: AmmanAccount
  slot: number
  accountDiff?: AccountDiff
  rendered?: string
}

class AccountStateTracker {
  readonly states: (AccountState & { timestamp: number })[] = []

  add(state: AccountState) {
    const lastState =
      this.states.length > 0 ? this.states[this.states.length - 1] : null
    const accountDiff: AccountDiff | undefined =
      lastState == null
        ? undefined
        : diff(lastState.account.pretty(), state.account.pretty())
    this.states.push({ ...state, accountDiff, timestamp: Date.now().valueOf() })
  }

  get relayStates() {
    return this.states.map(({ account, ...rest }) => ({
      account: account.pretty(),
      ...rest,
    }))
  }
}

export class AccountStates extends EventEmitter {
  readonly states: Map<string, AccountStateTracker> = new Map()

  private constructor(
    readonly connection: Connection,
    readonly accountProvider: AccountProvider
  ) {
    super()
    this.connection.onLogs('all', this._onLog, 'confirmed')
  }

  async update(address: string, slot: number) {
    if (!this.states.has(address)) {
      this.states.set(address, new AccountStateTracker())
    }

    const res = await this.accountProvider.tryResolveAccount(
      new PublicKey(address)
    )
    if (res == null) return

    this.add(address, { ...res, slot })
    this.emit(`account-changed:${address}`, this.get(address)?.relayStates)
  }

  add(address: string, state: AccountState) {
    const states = this.get(address)
    assert(states != null, 'expected states to be set before adding')
    states.add(state)
  }

  get(address: string): AccountStateTracker | undefined {
    return this.states.get(address)
  }

  private _onLog = async (logs: Logs, ctx: Context) => {
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
    accountProvider: AccountProvider
  ) {
    if (AccountStates._instance != null) return
    AccountStates._instance = new AccountStates(connection, accountProvider)
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
    if (typeof val === 'object') {
      prettified[key] = JSON.stringify(val, null, 2)
    }
  }
  return { ...account, ...prettified }
}
