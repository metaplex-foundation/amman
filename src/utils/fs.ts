import fs from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { strict as assert } from 'assert'

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
export function assertValidDirName(dir: string, msg?: string) {
  assert(
    !/^[a-zA-Z0-9_\-]+$/.test(dir),
    `Invalid directory name: ${dir}. ${msg ?? ''}`
  )
}
