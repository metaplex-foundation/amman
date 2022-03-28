import crypto from 'crypto'

export * from './fs'
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
 * Checks if a string is valid base58 via a Regex.
 * @private
 */
export function isValidAddress(address: string) {
  return /^[0-9a-zA-Z]+$/.test(address)
}
