import { Connection, Context, Logs } from '@solana/web3.js'
import { AmmanAccount } from '../types'
import { logDebug, logTrace } from '../utils/log'
import { AccountProvider } from './providers'
import { strict as assert } from 'assert'
import EventEmitter from 'events'

export type AccountState = {
  account: AmmanAccount
  slot: number
  rendered?: string
}

class AccountStateTracker {
  readonly states: (AccountState & { timestamp: number })[] = []

  add(state: AccountState) {
    this.states.push({ ...state, timestamp: Date.now().valueOf() })
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

  watch(address: string) {
    if (this.states.has(address)) return
    this.states.set(address, new AccountStateTracker())

    logTrace(`Watching account ${address}`)
    this.accountProvider.watchAccount(
      address,
      (account: AmmanAccount, slot: number, rendered?: string) => {
        logTrace(`Account ${address} changed`)
        this.add(address, { account, slot, rendered })
        this.emit(`account-changed:${address}`, this.get(address)?.relayStates)
      }
    )
  }

  add(address: string, state: AccountState) {
    const states = this.get(address)
    assert(states != null, 'expected states to be set before adding')
    states.add(state)
  }

  get(address: string): AccountStateTracker | undefined {
    return this.states.get(address)
  }

  private _onLog = async (logs: Logs, _ctx: Context) => {
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
      this.watch(key)
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
