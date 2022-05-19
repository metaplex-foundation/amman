import { Keypair, PublicKey, Signer } from '@solana/web3.js'
import { AmmanClient, ConnectedAmmanClient } from '../relay'
import { strict as assert } from 'assert'
import {
  extractSolanaAddresses,
  isPublicKeyAddress,
  isSignatureAddress,
  isValidSolanaAddress,
  logError,
} from '../utils'
import { mapLabel } from './address-label-mapper'
import { isKeyLike, KeyLike, publicKeyString } from '../utils/keys'

/** @private */
export type AddLabel = (
  label: string,
  key: KeyLike
) => Promise<string | undefined>
/** @private */
export type AddLabels = (labels: any) => Promise<AddressLabels>
/** @private */
export type GenKeypair = () => [PublicKey, Keypair]
/** @private */
export type GenLabeledKeypair = (
  label: string
) => Promise<[PublicKey, Keypair, string]>

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
   * @param knownLabels labels keyed as [address, label] known ahead of time, i.e. program ids.
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
    this.getRemoteLabelAddresses()
  }

  /**
   * Clears all address labels collected so far and instructs the {@link
   * ammanClient} to do the same.
   */
  async clear() {
    this.ammanClient.clearAddressLabels()
    this.knownLabels = {}
  }

  /**
   * Adds the provided label for the provided key.
   * If the label collides with an existing label, for a different key it will
   * be suffixed with a number.
   */
  addLabel: AddLabel = async (label, key) => {
    const keyString = publicKeyString(key)
    if (!isValidSolanaAddress(keyString)) return

    label = await this._nonCollidingLabel(mapLabel(label), keyString)
    this.logLabel(`🔑 ${label}: ${keyString}`)

    this.knownLabels[keyString] = label

    await this.ammanClient.addAddressLabels({ [keyString]: label })
    return label
  }

  /**
   * Adds labels for all {@link KeyLike}s it finds on the provided object
   * If the label collides with an existing label, for a different key it will
   * be suffixed with a number.
   */
  addLabels: AddLabels = async (obj) => {
    if (obj != null) {
      const labels: Record<string, string> = {}
      let synced = false
      for (let [label, key] of Object.entries(obj)) {
        if (typeof label === 'string' && isKeyLike(key)) {
          const keyString = publicKeyString(key)
          if (isValidSolanaAddress(keyString)) {
            label = await this._nonCollidingLabel(
              mapLabel(label),
              keyString,
              !synced
            )
            synced = true
            labels[keyString] = label
            this.knownLabels[keyString] = label
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
      label = await this._nonCollidingLabel(mapLabel(label), keyString)
      await this.addLabel(label, keyString)
    }
    return label
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
   * Resolves all addresses labeled with the {@link label}.
   * @returns addresses or empty if none found
   */
  resolveLabel(search: string) {
    const addresses = []
    for (const [key, label] of Object.entries(this.knownLabels)) {
      if (label === search) {
        addresses.push(key)
      }
    }
    return addresses
  }

  /**
   * Resolves a known label for the provided key or address querying the amman relay if it
   * isn't found in the cache.
   * @returns label for the address or `undefined` if not found
   */
  async resolveRemoteAddress(address: KeyLike): Promise<string | undefined> {
    address = publicKeyString(address)
    const localAddress = this.knownLabels[address]
    if (localAddress != null) return localAddress

    await this.getRemoteLabelAddresses()

    return this.knownLabels[address]
  }

  /**
   * Resolves an address for the  provided label querying the amman relay if it
   * isn't found in the cache.
   * @returns addresses labeled with the {@link label}
   */
  async resolveRemoteLabel(label: string): Promise<string[]> {
    await this.getRemoteLabelAddresses()
    return this.resolveLabel(label)
  }

  /**
   * Resolves all labeled addresses from the amman relay and updates the local labels.
   * @returns knownLabes all known labels after the update
   */
  async getRemoteLabelAddresses() {
    const remoteLabels = await this.ammanClient.fetchAddressLabels()
    this.knownLabels = { ...this.knownLabels, ...remoteLabels }
    return this.knownLabels
  }

  // -----------------
  // Keypairs
  // -----------------

  /**
   * Generates a keypair and returns its public key and the keypair itself as a
   * Tuple.
   *
   * @return [publicKey, keypair ]
   * @private
   */
  genKeypair: GenKeypair = () => {
    const kp = Keypair.generate()
    // NOTE: that this may fail to reach the relay before the app exists
    this.storeKeypair(kp).catch((err) => {
      logError('Ran into some issue trying to store the generated keypair')
      logError(err)
    })
    return [kp.publicKey, kp]
  }

  /**
   * Generates a keypair, labels it and returns its public key and the keypair
   * itself as a Tuple.
   *
   * @param label the key will be added to existing labels
   * @return [publicKey, keypair ]
   * @private
   */
  genLabeledKeypair: GenLabeledKeypair = async (label) => {
    const tuple = this.genKeypair()
    const labelUsed = await this.addLabel(label, tuple[0])
    const id = labelUsed ?? tuple[0].toBase58()
    await this.storeKeypair(tuple[1], id)
    return [...tuple, id]
  }

  /**
   * Stores the keypair in the relay using the provided label or public key as id.
   *
   * @private
   */
  storeKeypair(keypair: Keypair, label?: string) {
    return this.ammanClient.requestStoreKeypair(
      label ?? keypair.publicKey.toBase58(),
      keypair
    )
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

  async addLabelsFromText(
    labels: string[],
    text: string,
    opts: { transactionsOnly?: boolean; accountsOnly?: boolean } = {}
  ) {
    const { transactionsOnly = false, accountsOnly = false } = opts
    assert(
      !transactionsOnly || !accountsOnly,
      'cannot only filter by transactionsOnly or accountsOnly'
    )

    let addresses = extractSolanaAddresses(text)
    if (transactionsOnly) {
      addresses = addresses.filter(isSignatureAddress)
    } else if (accountsOnly) {
      addresses = addresses.filter(isPublicKeyAddress)
    }

    if (addresses.length < labels.length) {
      if (transactionsOnly) {
        logError('Was unable to find enough transaction only addresses')
      }
      if (accountsOnly) {
        logError('Was unable to find enough account only addresses')
      }
      throw Error(
        `Cannot auto-label ${labels.length} labels with ${addresses.length} addresses (not enough addresses)`
      )
    }

    const acc: Record<string, string> = {}
    for (let i = 0; i < labels.length; i++) {
      const address = addresses[i]!
      const label = labels[i]
      acc[label] = address.value
    }
    await this.addLabels(acc)
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

  private async _nonCollidingLabel(
    label: string,
    address: string,
    syncRemote = true
  ) {
    if (syncRemote) {
      await this.getRemoteLabelAddresses()
    }

    // We are actually trying to re-label a key that we labeled before
    if (this.knownLabels[address] != null) {
      return label
    }
    // It's a new key, so we'll make sure that we tweak the label such that
    // two different keys won't have the same label
    const labels = new Set(Object.values(this.knownLabels))
    if (!labels.has(label)) return label
    let i = 0
    do {
      i++
      const indexedLabel = `${label}-${i}`
      if (!labels.has(indexedLabel)) return indexedLabel
    } while (true)
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
