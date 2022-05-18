import { getAccount, getMint, Mint, Account } from '@solana/spl-token'
import { AccountInfo, Connection, PublicKey } from '@solana/web3.js'
import numeral from 'numeral'
import { Amman } from '../api'
import {
  AmmanAccount,
  AmmanAccountProvider,
  AmmanAccountRendererMap,
} from '../types'
import { LOCALHOST, logDebug, logError, logTrace } from '../utils'
import { isKeyLike, publicKeyString } from '../utils/keys'
import { isAccount, isMint } from './types'

const AMMAN_TRACE_UNRESOLVED_ACCOUNTS =
  process.env.AMMAN_TRACE_UNRESOLVED_ACCOUNTS != null

export const DEFAULT_MINT_DECIMALS = 9

/** @private */
export type HandleWatchedAccountChanged = (
  account: AmmanAccount,
  slot: number,
  data: Buffer,
  rendered?: string
) => void

type AmmanFixedAccountProvider = AmmanAccountProvider & {
  byteSize: number
}

function hasKnownByteSize(
  x: AmmanAccountProvider
): x is AmmanFixedAccountProvider {
  return typeof x.byteSize === 'number'
}

function isAmmanAccountProvider(x: any): x is AmmanAccountProvider {
  const provider = x as AmmanAccountProvider
  return (
    typeof provider.fromAccountInfo === 'function' &&
    (hasKnownByteSize(provider) || typeof provider.byteSize === 'function')
  )
}
/**
 * @private
 */
export class AccountProvider {
  /**
   * providers by size
   * size: 0 is used for providers of accounts that don't have a fixed size
   */
  readonly byByteSize: Map<number, AmmanAccountProvider[]> = new Map()
  readonly nonfixedProviders: AmmanAccountProvider[] = []
  readonly connection: Connection = new Connection(LOCALHOST, 'confirmed')

  private constructor(
    providers: AmmanAccountProvider[],
    private readonly renderers: AmmanAccountRendererMap
  ) {
    this._mapProviders(providers)
  }

  static fromRecord(
    record: Record<string, any>,
    renderers: AmmanAccountRendererMap
  ) {
    const providers = Object.values(record).filter(isAmmanAccountProvider)
    return new AccountProvider(providers, renderers)
  }

  private _mapProviders(providers: AmmanAccountProvider[]) {
    for (const provider of providers) {
      const size = hasKnownByteSize(provider) ? provider.byteSize : 0
      if (size === 0) {
        this.nonfixedProviders.push(provider)
      } else {
        const providersForSize = this.byByteSize.get(size)
        if (providersForSize == null) {
          this.byByteSize.set(size, [provider])
        } else {
          providersForSize.push(provider)
        }
      }
    }
    const providersWithRender = providers.filter((x) => this.renderers.has(x))
    logDebug(
      'Registered %d providers, %d of which have a renderer',
      providers.length,
      providersWithRender.length
    )
    logTrace({ providersBySize: this.byByteSize })
    logTrace({ providersUnknownSize: this.nonfixedProviders })
  }

  async tryResolveAccount(
    publicKey: PublicKey,
    accountInfo?: AccountInfo<Buffer>
  ) {
    accountInfo ??=
      (await this.connection.getAccountInfo(publicKey)) ?? undefined

    return accountInfo != null
      ? this._getProviderAndResolveAccount(accountInfo, publicKey)
      : undefined
  }

  async syncAccountInformation(publicKey: PublicKey): Promise<
    | {
        account: AmmanAccount | undefined
        rendered: string | undefined
        data: Buffer
      }
    | undefined
  > {
    logTrace(`Resolving account ${publicKey.toBase58()}`)
    let accountInfo: AccountInfo<Buffer> | null
    try {
      accountInfo = await this.connection.getAccountInfo(publicKey, 'confirmed')
    } catch (err) {
      logError(err)
      return
    }
    if (accountInfo == null) {
      logTrace('Unable to find account info for', publicKey.toBase58())
      return
    }
    return this._getProviderAndResolveAccount(accountInfo, publicKey)
  }

  private async _getProviderAndResolveAccount(
    accountInfo: AccountInfo<Buffer>,
    publicKey: PublicKey
  ): Promise<
    | {
        account: AmmanAccount | undefined
        rendered: string | undefined
        data: Buffer
      }
    | undefined
  > {
    if (
      accountInfo.lamports === 0 ||
      accountInfo.executable ||
      accountInfo.data.byteLength === 0
    ) {
      return
    }

    let res = this._resolveFromProviderMatching(accountInfo, publicKey)
    if (res != null) {
      logTrace(res)
      return { ...res, data: accountInfo.data }
    }

    // No matching provider found, let's try the ones for non-fixed accounts or builtins from the token program
    res =
      this._tryResolveAccountFromProviders(
        this.nonfixedProviders,
        accountInfo
      ) ?? (await this._tryResolveAccountFromBuiltins(publicKey))
    return {
      account: res?.account,
      rendered: res?.rendered,
      data: accountInfo.data,
    }
  }

  _resolveFromProviderMatching(
    accountInfo: AccountInfo<Buffer>,
    publicKey: PublicKey
  ): { account: AmmanAccount; rendered: string | undefined } | undefined {
    const providers = this.byByteSize.get(accountInfo.data.byteLength)
    if (providers == null) {
      logTrace(
        'Unable to find a provider by byteSize for %s',
        publicKey.toBase58()
      )
      logTrace({
        size: accountInfo.data.byteLength,
        allProvidersByByteSize: this.byByteSize,
      })
      return
    }
    logTrace('Found providers for %s, %O', publicKey.toBase58(), providers)
    return this._tryResolveAccountFromProviders(providers, accountInfo)
  }

  private _tryResolveAccountFromProviders(
    providers: AmmanAccountProvider[],
    accountInfo: AccountInfo<Buffer>
  ): { account: AmmanAccount; rendered: string | undefined } | undefined {
    for (const provider of providers) {
      try {
        return this._resolveAccount(provider, accountInfo)
      } catch (err) {
        if (AMMAN_TRACE_UNRESOLVED_ACCOUNTS) {
          logTrace(err)
        }
      }
    }
  }

  private async _tryResolveAccountFromBuiltins(address: PublicKey) {
    for (const provider of [getMint, getAccount]) {
      try {
        const account = await provider(this.connection, address, 'singleGossip')
        if (account != null) {
          const ammanAccount = await this._toAmmanAccount(account)
          return {
            account: ammanAccount,
            rendered: undefined,
          }
        }
      } catch (err) {
        logTrace(err)
      }
    }
  }

  private _resolveAccount(
    provider: AmmanAccountProvider,
    accountInfo: AccountInfo<Buffer>
  ): { account: AmmanAccount; rendered: string | undefined } {
    const [account] = provider.fromAccountInfo(accountInfo)
    const render = this.renderers.get(provider)
    const rendered = render != null ? render(account) : undefined
    return { account, rendered }
  }

  // -----------------
  // Helpers
  // -----------------
  private async _toAmmanAccount(
    account: Mint | Account
  ): Promise<AmmanAccount> {
    const acc: Record<string, any> = {}
    const amountDivisor = isAccount(account)
      ? (await this._getMintDecimals(account.mint)).divisor
      : isMint(account)
      ? Math.pow(10, account.decimals)
      : 1
    for (let [key, value] of Object.entries(account)) {
      if (value == null) {
        acc[key] = value
      } else if (isKeyLike(value)) {
        const publicKeyStr = publicKeyString(value)
        const label = await this._tryResolveAddressRemote(publicKeyStr)
        acc[key] = label == null ? publicKeyStr : `${label} (${publicKeyStr})`
      } else if (typeof value === 'bigint') {
        const formatted = numeral(value).format('0,0')
        // Mint specific adjustments
        if (key === 'amount' || key === 'supply') {
          const balance = value / BigInt(amountDivisor)
          acc[key] = formatted + ` (balance: ${balance.toString()})`
        } else {
          acc[key] = formatted
        }
      } else if (typeof value === 'number') {
        acc[key] = numeral(value).format('0,0')
      } else if (typeof value.pretty === 'function') {
        acc[key] = value.pretty()
      } else if (typeof value === 'object') {
        acc[key] = JSON.stringify(value)
      } else {
        acc[key] = value
      }
    }
    return {
      pretty() {
        return acc
      },
    }
  }

  private async _getMintDecimals(
    publicKey: PublicKey
  ): Promise<{ decimals: number; divisor: number }> {
    let decimals: number
    try {
      const mint = await getMint(this.connection, publicKey, 'singleGossip')
      decimals = mint.decimals
    } catch (err) {
      decimals = DEFAULT_MINT_DECIMALS
    }
    const divisor = Math.pow(10, decimals)
    return { decimals, divisor }
  }

  private async _tryResolveAddressRemote(publicKeyStr: string) {
    try {
      const instance = Amman.existingInstance
      if (instance == null) return
      return await instance.addr.resolveRemoteAddress(publicKeyStr)
    } catch (err) {
      logError(err)
    }
  }
}
