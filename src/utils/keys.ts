import { Keypair, PublicKey } from '@solana/web3.js'

/**
 * Represents anything that can be used to extract the base58 representation
 * of a public key.
 * @private
 */
export type KeyLike = string | PublicKey | Keypair

export function isKeyLike(val: any): val is KeyLike {
  if (val == null) return false
  return (
    typeof val === 'string' ||
    typeof (val as PublicKey).toBase58 === 'function' ||
    (val as Keypair).publicKey != null
  )
}
export function publicKeyString(key: KeyLike) {
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
