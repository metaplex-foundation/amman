import crypto from 'crypto'
import { tmpdir } from 'os'
import path from 'path'

export * from './address'
export * from './guards'
export * from './log'

/**
 * URL at which a locally running solana test validator listens on by default
 * @category utils
 */
export const LOCALHOST = 'http://127.0.0.1:8899/'

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
 * Custom JSON.stringify which avoids failing on bigint values
 * @category utils
 */
export function safeJsonStringify(obj: any) {
  return JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  )
}
