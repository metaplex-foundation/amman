import debug from 'debug'
import { tmpdir } from 'os'
import path from 'path'
import crypto from 'crypto'
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'

/**
 * URL at which a locally running solana test validator listens on by default
 * @category utils
 */
export const LOCALHOST = 'http://127.0.0.1:8899/'

export const logError = debug('amman:error')
export const logInfo = debug('amman:info')
export const logDebug = debug('amman:debug')
export const logTrace = debug('amman:trace')

/**
 * Gets the path to a temporary directory in which to store the test
 * validator ledger.
 *
 * @param testLabel label used to name that directory
 * @category utils
 */
export function tmpLedgerDir(testLabel = 'amman-ledger') {
  return path.join(tmpdir(), testLabel)
}

/**
 * @private
 */
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * @private
 */
export function createHash(s: Buffer) {
  return crypto.createHash('sha256').update(s).digest('hex')
}

/**
 * Drops the specified amount of tokens to the provided public key.
 *
 * @param connection to solana JSON RPC node
 * @param publicKey to drop sols to
 * @param sol amount of sols to drop
 *
 * @category utils
 */
export async function airdrop(
  connection: Connection,
  publicKey: PublicKey,
  sol = 1
) {
  const sig = await connection.requestAirdrop(publicKey, sol * LAMPORTS_PER_SOL)
  const signatureResult = await connection.confirmTransaction(sig)
  return { signature: sig, signatureResult }
}
