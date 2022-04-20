import { Connection, Context, Logs } from '@solana/web3.js'
import { AmmanAccount } from '../types'
import { logDebug, logTrace } from '../utils/log'
import { AccountProvider } from './providers'
import { strict as assert } from 'assert'

export type AccountState = { account: AmmanAccount; rendered?: string }
export type RelayAccountState = {
  account: Record<string, any>
  rendered?: string
  timestamp: number
}

class AccountStateTracker {
  readonly states: (AccountState & { timestamp: number })[] = []

  add(state: AccountState) {
    this.states.push({ ...state, timestamp: Date.now().valueOf() })
  }

  get relayStates() {
    return this.states.map(({ account, rendered, timestamp }) => ({
      account: account.pretty(),
      rendered,
      timestamp,
    }))
  }
}

export class AccountStates {
  readonly states: Map<string, AccountStateTracker> = new Map()

  private constructor(
    readonly connection: Connection,
    readonly accountProvider: AccountProvider
  ) {
    this.connection.onLogs('all', this._onLog, 'confirmed')
  }

  watch(address: string) {
    if (this.states.has(address)) return
    this.states.set(address, new AccountStateTracker())

    logDebug(`Watching account ${address}`)
    this.accountProvider.watchAccount(
      address,
      (account: AmmanAccount, rendered?: string) => {
        this.add(address, { account, rendered })
      }
    )
  }

  add(address: string, state: AccountState) {
    this.get(address).add(state)
  }

  get(address: string): AccountStateTracker {
    if (!this.states.has(address)) {
      this.states.set(address, new AccountStateTracker())
    }
    return this.states.get(address)!
  }

  private _onLog = async (logs: Logs, _ctx: Context) => {
    const tx = await this.connection.getTransaction(logs.signature, {
      commitment: 'confirmed',
    })
    if (tx == null) {
      logTrace(`Could not find transaction ${logs.signature}`)
      return
    }
    if (tx.transaction != null) {
      for (const key of tx.transaction.message.accountKeys) {
        this.watch(key.toBase58())
      }
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
