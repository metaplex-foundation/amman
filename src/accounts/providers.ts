import { AccountInfo, Connection, PublicKey } from '@solana/web3.js'
import { AmmanAccountProvider, AmmanDetectingAccountProvider } from '../types'
import { LOCALHOST, logDebug, logError, logTrace } from '../utils'

function isAmmanAccountProvider(x: any): x is AmmanAccountProvider {
  const provider = x as AmmanAccountProvider
  return (
    typeof provider.fromAccountInfo === 'function' &&
    typeof provider.byteSize === 'number'
  )
}
function isAmmanDetectingAccountProvider(
  x: AmmanAccountProvider
): x is AmmanDetectingAccountProvider {
  return typeof x.canDeserialize === 'function'
}

/**
 * @private
 */
export class AccountProvider {
  readonly byByteSize: Map<number, AmmanAccountProvider[]> = new Map()
  readonly connection: Connection = new Connection(LOCALHOST, 'singleGossip')
  constructor(providers: AmmanAccountProvider[]) {
    this._mapProviders(providers)
  }

  static fromRecord(record: Record<string, any>) {
    const providers = Object.values(record).filter(isAmmanAccountProvider)
    logDebug({ providers })
    return new AccountProvider(providers)
  }

  private _mapProviders(providers: AmmanAccountProvider[]) {
    for (const provider of providers) {
      const size = provider.byteSize
      const providersForSize = this.byByteSize.get(size)
      if (providersForSize == null) {
        this.byByteSize.set(size, [provider])
      } else {
        const detectingProviders = providersForSize.filter(
          isAmmanDetectingAccountProvider
        )
        if (!isAmmanDetectingAccountProvider(provider)) {
          // This provider does not detect if it can serialize, so we need to
          // ensure all currently added providers for that size can, otherwise we
          // cannot disambiguate
          const allLen = providersForSize.length
          const detectingLen = detectingProviders.length
          if (detectingLen < allLen) {
            throw new Error(
              `Cannot add another provider ${provider} for size ${size} that cannot detect if it can deserialize specific data`
            )
          }
        }
        providersForSize.push(provider)
      }
    }
    // Sort providers such that the one which cannot detect if it can serialize comes last
    for (const providers of this.byByteSize.values()) {
      providers.sort((a, _) => (isAmmanDetectingAccountProvider(a) ? -1 : 1))
    }
  }

  findProvider(buf: Buffer) {
    const providers = this.byByteSize.get(buf.byteLength)
    if (providers == null) return
    if (providers.length > 1) {
    } else {
      return providers[0]
    }
  }

  async account(accountAddress: string) {
    logTrace(`Resolving account ${accountAddress}`)
    let accountInfo: AccountInfo<Buffer> | null
    try {
      const publicKey = new PublicKey(accountAddress)
      // TODO(thlorenz): Watch account
      // this.connection.onAccountChange(publicKey, )
      accountInfo = await this.connection.getAccountInfo(
        publicKey,
        'singleGossip'
      )
    } catch (err) {
      logError(err)
      return
    }
    if (accountInfo == null) return
    const provider = this.findProvider(accountInfo.data)
    if (provider == null) return
    const [account] = provider.fromAccountInfo(accountInfo)
    const pretty = account.pretty()
    return { pretty }
  }
}
