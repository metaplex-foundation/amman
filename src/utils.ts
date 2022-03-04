import debug from 'debug'
import { tmpdir } from 'os'
import path from 'path'
import crypto from 'crypto'

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
