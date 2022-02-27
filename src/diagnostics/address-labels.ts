import { Keypair, PublicKey, Signer } from '@solana/web3.js'
import { AmmanClient } from '../relay'

/**
 * Represents anything that can be used to extract the base58 representation
 * of a public key.
 * @private
 */
export type KeyLike = string | PublicKey | Keypair

function isKeyLike(val: any): val is KeyLike {
  if (val == null) return false
  return (
    typeof val === 'string' ||
    typeof (val as PublicKey).toBase58 === 'function' ||
    (val as Keypair).publicKey != null
  )
}
function publicKeyString(key: KeyLike) {
  if (typeof key === 'string') {
    return key
  }
  if (typeof (key as PublicKey).toBase58 === 'function') {
    return (key as PublicKey).toBase58()
  }
  if (typeof (key as Keypair).publicKey != null) {
    return (key as Keypair).publicKey.toBase58()
  }
  return key.toString()
}

/** @private */
export type AddLabel = (label: string, key: KeyLike) => void
/** @private */
export type AddLabels = (labels: any) => void
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
  constructor(
    private readonly knownLabels: Record<string, string>,
    private readonly logLabel: (msg: string) => void = (_) => {},
    private readonly ammanClient: AmmanClient = AmmanClient.getInstance()
  ) {
    this.ammanClient.addAddressLabels(knownLabels)
  }

  /**
   * Adds the provided label for the provided key.
   */
  addLabel: AddLabel = (label, key) => {
    const keyString = publicKeyString(key)
    this.logLabel(`🔑 ${label}: ${keyString}`)

    this.knownLabels[keyString] = label

    this.ammanClient.addAddressLabels({ [keyString]: label })
  }

  /**
   * Adds labels for all {@link KeyLike}s it finds on the provided object
   */
  addLabels: AddLabels = (obj) => {
    for (const [label, key] of Object.entries(obj)) {
      if (typeof label === 'string' && isKeyLike(key)) {
        this.addLabel(label, key)
      }
    }
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
   * Generates a keypair and returns its public key and the keypair itself as a Tuple.
   *
   * @param label if provided the key will be added to existing labels
   * @return [publicKey, keypair ]
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
}
