import { Keypair, PublicKey } from '@solana/web3.js'
import fs from 'fs'

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
 * Adds the key with the provided label to the known keys map.
 * This improves output of assertions and more.
 *
 * When the `ADDRESS_LABEL_PATH` env var is provided this writes a map of keypair:label entries
 * to the provided path in JSON format.
 * These can then be picked up by tools like the solana explorer in order to
 * render more meaningful labels of accounts.
 */
export class AddressLabels {
  constructor(
    private readonly knownLabels: Record<string, string>,
    private readonly logLabel: (msg: string) => void = (_) => {},
    private readonly persistLabelsPath?: string
  ) {}

  addLabel(label: string, key: KeyLike) {
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

  isKeyOf(key: KeyLike) {
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
