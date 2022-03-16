import { AccountInfo, Connection, PublicKey } from '@solana/web3.js'
import {
  AmmanAccount,
  AmmanAccountProvider,
  AmmanAccountRendererMap,
} from '../types'
import { LOCALHOST, logDebug, logError, logTrace } from '../utils'

export type HandleWatchedAccountChanged = (
  account: AmmanAccount,
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
  readonly connection: Connection = new Connection(LOCALHOST, 'singleGossip')
  constructor(
    providers: AmmanAccountProvider[],
    readonly renderers: AmmanAccountRendererMap
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
  }

  async watchAccount(
    accountAddress: string,
    onChanged: HandleWatchedAccountChanged
  ) {
    let publicKey: PublicKey
    try {
      publicKey = new PublicKey(accountAddress)
    } catch (err) {
      logError(
        `Invalid account address ${accountAddress}. Unable to create PublicKey`
      )
      logError(err)
      return
    }
    {
      const res = await this._syncAccountInfo(publicKey)
      if (res != null) {
        onChanged(res.account, res.rendered)
      }
    }

    this.connection.onAccountChange(
      publicKey,
      async (accountInfo: AccountInfo<Buffer>) => {
        const res = await this._getProviderAndResolveAccount(
          accountInfo,
          publicKey
        )
        if (res != null) {
          onChanged(res.account, res.rendered)
        }
      }
    )
  }

  private async _syncAccountInfo(publicKey: PublicKey) {
    logTrace(`Resolving account ${publicKey.toBase58()}`)
    let accountInfo: AccountInfo<Buffer> | null
    try {
      accountInfo = await this.connection.getAccountInfo(
        publicKey,
        'singleGossip'
      )
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
  ) {
    if (
      accountInfo.lamports === 0 ||
      accountInfo.executable ||
      accountInfo.data.byteLength === 0
    ) {
      return
    }

    const res = this._resolveFromProviderMatching(accountInfo, publicKey)
    if (res != null) {
      logTrace(res)
      return res
    }

    // No matching provider found, let's try the ones for non-fixed accounts
    return this._tryResolveAccountFromProviders(
      this.nonfixedProviders,
      accountInfo
    )
  }

  _resolveFromProviderMatching(
    accountInfo: AccountInfo<Buffer>,
    publicKey: PublicKey
  ) {
    const providers = this.byByteSize.get(accountInfo.data.byteLength)
    if (providers == null) {
      logTrace('Unable to find a provider for %s', publicKey.toBase58())
      logTrace({
        size: accountInfo.data.byteLength,
        allProviders: this.byByteSize,
      })
      return
    }
    logTrace('Found providers for %s, %O', publicKey.toBase58(), providers)
    return this._tryResolveAccountFromProviders(providers, accountInfo)
  }

  private _tryResolveAccountFromProviders(
    providers: AmmanAccountProvider[],
    accountInfo: AccountInfo<Buffer>
  ) {
    for (const provider of providers) {
      try {
        return this._resolveAccount(provider, accountInfo)
      } catch (err) {
        logTrace(err)
      }
    }
  }

  private _resolveAccount(
    provider: AmmanAccountProvider,
    accountInfo: AccountInfo<Buffer>
  ) {
    const [account] = provider.fromAccountInfo(accountInfo)
    const render = this.renderers.get(provider)
    const rendered = render != null ? render(account) : undefined
    return { account, rendered }
  }
}
