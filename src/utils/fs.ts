import fs from 'fs'
import { strict as assert } from 'assert'
import { R_OK } from 'constants'
import { Keypair } from '@solana/web3.js'
import { logError } from '.'

/**
 * Ensures that a file or directory is accessible to the current user.
 * @private
 */
export function canAccessSync(p: string) {
  try {
    fs.accessSync(p)
    return true
  } catch (_) {
    return false
  }
}

/**
 * Ensures that a file or directory is accessible to the current user.
 * @private
 */
export async function canAccess(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p, R_OK)
    return true
  } catch (e) {
    return false
  }
}
/**
 * Ensures that a file or directory is readable to the current user.
 * @private
 */
export async function canRead(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p, R_OK)
    return true
  } catch (e) {
    return false
  }
}

/**
 * Ensures that a directory is accessible to the current user.
 * IF the directory doesn't exist it attempts to create it recursively.
 * @private
 */
export function ensureDirSync(dir: string) {
  if (!canAccessSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    return
  }
  // dir already exists, make sure it isn't a file
  const stat = fs.statSync(dir)
  if (!stat.isDirectory()) {
    throw new Error(`'${dir}' is not a directory`)
  }
}

/** @private */
export async function keypairFromFile(fullPath: string): Promise<Keypair> {
  assert(
    await canAccess(fullPath),
    `File ${fullPath} does not exist or is not readable`
  )
  const keypairString = await fs.promises.readFile(fullPath, 'utf8')
  try {
    const secretKey = Uint8Array.from(JSON.parse(keypairString))
    return Keypair.fromSecretKey(secretKey)
  } catch (err) {
    logError(err)
    throw new Error(`File ${fullPath} does not contain a valid keypair`)
  }
}

/** @private */
export async function ensureDirCleaned(dir: string) {
  if (!canRead(dir)) return
  return fs.promises.rm(dir, { recursive: true })
}

/** @private */
export function assertValidPathSegmentWithoutSpaces(p: string, msg?: string) {
  assert(/^[a-zA-Z0-9_-]+$/.test(p), `Invalid path segment: ${p}. ${msg ?? ''}`)
}
