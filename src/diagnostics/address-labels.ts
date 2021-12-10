import { Keypair, PublicKey } from '@solana/web3.js'
import fs from 'fs'

/**
 * Represents anything that can be used to extract the base58 representation
 * of a public key.
 */
export type KeyLike = string | PublicKey | Keypair
function publicKeyString(key: KeyLike) {
  if (typeof key === 'string') {
    return key
  }
  if (typeof (key as PublicKey).toBase58 === 'function') {
    return (key as PublicKey).toBase58()
  }
  if (typeof (key as Keypair).publicKey !== null) {
    return (key as Keypair).publicKey.toBase58()
  }
  return key.toString()
}

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
   * @param persistLabelsPath  path to which labels are persisted so other tools can pick them up
   *  WARN: this will most likely be replaced soon with either a URL to post labels to or
   *  something else that integrates with the (yet to come) amman address label server
   */
  constructor(
    private readonly knownLabels: Record<string, string>,
    private readonly logLabel: (msg: string) => void = (_) => {},
    private readonly persistLabelsPath?: string
  ) {}

  /**
   * Adds the provided label for the provided key.
   */
  addLabel = (label: string, key: KeyLike) => {
    const keyString = publicKeyString(key)
    this.logLabel(`🔑 ${label}: ${keyString}`)

    this.knownLabels[keyString] = label

    if (this.persistLabelsPath == null) return
    fs.writeFileSync(
      this.persistLabelsPath,
      JSON.stringify(this.knownLabels, null, 2),
      'utf8'
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
}
