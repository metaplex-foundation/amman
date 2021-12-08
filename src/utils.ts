import debug from 'debug'
import { tmpdir } from 'os'
import path from 'path'
import crypto from 'crypto'
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'

export const LOCALHOST = 'http://127.0.0.1:8899/'

export const logError = debug('amman:error')
export const logInfo = debug('amman:info')
export const logDebug = debug('amman:debug')
export const logTrace = debug('amman:trace')

export function tmpLedgerDir(testLabel = 'amman-ledger') {
  return path.join(tmpdir(), testLabel)
}

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

export function createHash(s: Buffer) {
  return crypto.createHash('sha256').update(s).digest('hex')
}

export async function airdrop(
  connection: Connection,
  publicKey: PublicKey,
  sol = 1
) {
  const sig = await connection.requestAirdrop(publicKey, sol * LAMPORTS_PER_SOL)
  return connection.confirmTransaction(sig)
}
