import { Keypair } from '@solana/web3.js'
import { sha3_512, Message } from 'js-sha3'
import nacl from 'tweetnacl'

/**
 * Derives a keypair from a message signed with the provided keypair.
 *
 * @param message - which is signed and then used to derive the seed digest
 */
export function deriveFromKeypair(keypair: Keypair, message: string) {
  const signedMessage = nacl.sign.detached(
    Buffer.from(message),
    keypair.secretKey
  )

  return deriveInsecure(signedMessage)
}

/**
 * Derives a keypair from a message signed with the provided wallet.
 *
 * @param message - which is signed and then used to derive the seed digest
 */
export async function deriveFromWallet(
  wallet: {
    signMessage(message: Uint8Array): Promise<Uint8Array>
  },
  message: string
) {
  const signedMessage = await wallet.signMessage(Buffer.from(message))
  return deriveInsecure(signedMessage)
}

/**
 * Derives a keypair from a message.
 *
 * **WARN: only use this for testing purposes.**
 * Use {@link deriveFromWallet} or {@link deriveFromKeypair} instead in a production environment.
 *
 * This is entirely insecure as anyone with that same message can derive the same keypair.
 *
 * @param message - from wich the seed digest is derived
 */
export function deriveInsecure(message: Message) {
  const hash = sha3_512.arrayBuffer(message)
  const digest = Buffer.from(hash.slice(0, 32))

  return Keypair.fromSeed(digest)
}
