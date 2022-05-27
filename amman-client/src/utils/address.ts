import { PublicKey } from '@solana/web3.js'

const captureSolanaAddressRx = /(\b[0-9a-zA-Z]{43,88})\b/g

/**
 * Checks if a string is valid base58 Solana via a Regex.
 * @private
 */
export function isValidSolanaAddress(address: string) {
  return /^[0-9a-zA-Z]{43,88}$/.test(address)
}

/**
 * Checks if a string is valid PublicKey address.
 * @private
 */
export function isValidPublicKeyAddress(address: string) {
  if (!isValidSolanaAddress(address) || address.length > 44) return false
  try {
    new PublicKey(address)
    return true
  } catch (_) {
    return false
  }
}

export const addressTypes = ['publicKey', 'signature']
export type AddressType = typeof addressTypes[number]
export type Address = {
  type: AddressType
  value: string
}

export function isPublicKeyAddress(
  address: Address
): address is { type: 'publicKey'; value: string } {
  return address.type === 'publicKey'
}

export function isSignatureAddress(
  address: Address
): address is { type: 'signature'; value: string } {
  return address.type === 'signature'
}

export function extractSolanaAddresses(text: string): Address[] {
  const matches = text.match(captureSolanaAddressRx) ?? []

  return matches
    .slice(0)
    .map(identifySolanaAddress)
    .filter((x) => x != null) as Address[]
}

export function identifySolanaAddress(maybeAddress: string): Address | null {
  if (maybeAddress.length <= 44)
    return { type: 'publicKey', value: maybeAddress }
  if (maybeAddress.length >= 87)
    return { type: 'signature', value: maybeAddress }
  return null
}
