import { Keypair, PublicKey, Signer } from '@solana/web3.js'
import { AmmanClient, ConnectedAmmanClient } from '../relay'
import { strict as assert } from 'assert'
import { isValidAddress } from '../utils'
import { mapLabel } from './address-label-mapper'
import { isKeyLike, KeyLike, publicKeyString } from '../utils/keys'

/** @private */
export type AddLabel = (label: string, key: KeyLike) => Promise<AddressLabels>
/** @private */
export type AddLabels = (labels: any) => Promise<AddressLabels>
/** @private */
export type GenKeypair = (label?: string) => [PublicKey, Keypair]

/**
 * Manages address labels in order to improve logging and provide them to tools
 * like the solana explorer.
 *
 * @category diagnostics
 */
export class AddressLabels {
  /**
   * Creates an instance of {@link AddressLabels}.
   *
   * @param knownLabels labels known ahead of time, i.e. program ids.
   * @param logLabel if provided to added labels are logged using this function
   */
  private constructor(
    private knownLabels: Record<string, string>,
    private readonly logLabel: (msg: string) => void = (_) => {},
    private readonly ammanClient: AmmanClient = ConnectedAmmanClient.getInstance()
  ) {
    if (typeof ammanClient === 'string') {
      console.error(
        'ADDRESS_LABLES_PATH is deprecated, you do not need to pass it anymore'
      )
      ammanClient = ConnectedAmmanClient.getInstance()
    }
    if (Object.keys(knownLabels).length > 0) {
      this.ammanClient.addAddressLabels(knownLabels)
    }
  }

  /**
   * Clears all address labels collected so far and instructs the {@link
   * ammanClient} to do the same.
   */
  clear() {
    this.knownLabels = {}
  }

  /**
   * Adds the provided label for the provided key.
   */
  addLabel: AddLabel = async (label, key) => {
    const keyString = publicKeyString(key)
    if (!isValidAddress(keyString)) return this

    this.logLabel(`🔑 ${label}: ${keyString}`)

    this.knownLabels[keyString] = label

    await this.ammanClient.addAddressLabels({ [keyString]: mapLabel(label) })
    return this
  }

  /**
   * Adds labels for all {@link KeyLike}s it finds on the provided object
   */
  addLabels: AddLabels = async (obj) => {
    if (obj != null) {
      const labels: Record<string, string> = {}
      for (const [label, key] of Object.entries(obj)) {
        if (typeof label === 'string' && isKeyLike(key)) {
          const keyString = publicKeyString(key)
          if (isValidAddress(keyString)) {
            this.knownLabels[keyString] = label
            labels[keyString] = mapLabel(label)
            this.logLabel(`🔑 ${label}: ${keyString}`)
          }
        }
      }
      await this.ammanClient.addAddressLabels(labels)
    }
    return this
  }

  /**
   * Adds the provided label for the provided key unless a label for that key
   * was added previously.
   */
  addLabelIfUnknown: AddLabel = async (label, key) => {
    const keyString = publicKeyString(key)
    if (this.knownLabels[keyString] == null) {
      await this.addLabel(label, keyString)
    }
    return this
  }

  /**
   * Resolves the {@link PublicKey}s for the given signers/keypairs.
   *
   * @return resolvedKeys which are labels for known public keys or the public key
   */
  resolveKeypairs(pairs: (Signer | Keypair)[] | Object) {
    if (Array.isArray(pairs)) {
      return pairs.map((x) => {
        const keyString = x.publicKey.toBase58()
        return { label: this.knownLabels[keyString] ?? '', key: keyString }
      })
    } else {
      return this._findAndResolveKeypairs(pairs)
    }
  }

  /**
   * Resolves a known label for the provided key or address
   * @returns label for the address or `undefined` if not found
   */
  resolve(keyOrAddress: KeyLike | string): string | undefined {
    const address = publicKeyString(keyOrAddress)
    return this.knownLabels[address]
  }

  /**
   * Resolves a known label for the provided key or address querying the amman relay if it
   * isn't found in the cache.
   * @returns label for the address or `undefined` if not found
   */
  async resolveRemote(
    keyOrAddress: KeyLike | string
  ): Promise<string | undefined> {
    const address = publicKeyString(keyOrAddress)
    const localAddress = this.knownLabels[address]
    if (localAddress != null) return localAddress

    const remoteLabels = await this.ammanClient.fetchAddressLabels()
    // Remote labels are keyed `address: label`
    // reverse key and value
    const labels = Object.fromEntries(
      Object.entries(remoteLabels).map(([key, value]) => [value, key])
    )
    this.knownLabels = { ...labels, ...this.knownLabels }
    return this.knownLabels[address]
  }

  /**
   * Generates a keypair and returns its public key and the keypair itself as a Tuple.
   *
   * @param label if provided the key will be added to existing labels
   * @return [publicKey, keypair ]
   * @private
   */
  genKeypair: GenKeypair = (label) => {
    const kp = Keypair.generate()
    if (label != null) {
      this.addLabel(label, kp)
    }
    return [kp.publicKey, kp]
  }

  /**
   * Returns a function that allows comparing the provided key with another and
   * can be used for assertion tools like {@link spok | https://github.com/thlorenz/spok }.
   */
  isKeyOf = (key: KeyLike) => {
    const keyString = publicKeyString(key)
    const label = this.knownLabels[keyString]
    const fn = (otherKey: KeyLike) => {
      const otherKeyString = publicKeyString(otherKey)
      return keyString === otherKeyString
    }
    if (label != null) {
      fn.$spec = `isKeyOf('${label}')`
    }
    return fn
  }

  /**
   * Resolves the {@link PublicKey}s for the signers/keypairs it finds on the provided object.
   *
   * @return resolvedKeys which are labels for known public keys or the public key
   */
  private _findAndResolveKeypairs(obj: any) {
    const pairs: [string, KeyLike][] = Object.entries(obj).filter(
      ([key, val]) => typeof key === 'string' && isKeyLike(val)
    ) as [string, KeyLike][]

    return pairs.map(([key, val]) => {
      const keyString = publicKeyString(val)
      return { label: this.knownLabels[keyString] ?? key, key: keyString }
    })
  }

  // -----------------
  // Instance
  // -----------------
  private static _instance: AddressLabels | undefined
  static setInstance(
    knownLabels: Record<string, string>,
    logLabel?: (msg: string) => void,
    ammanClient?: AmmanClient
  ) {
    if (AddressLabels._instance != null) {
      console.error('Can only set AddressLabels instance once')
      return AddressLabels._instance
    }
    AddressLabels._instance = new AddressLabels(
      knownLabels,
      logLabel,
      ammanClient
    )
    return AddressLabels._instance
  }
  static get instance() {
    assert(
      AddressLabels._instance != null,
      'need to AddressLabels.setInstance first'
    )
    return AddressLabels._instance!
  }
}
