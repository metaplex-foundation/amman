import fs from 'fs'
import { strict as assert } from 'assert'
import { R_OK } from 'constants'

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
export async function ensureDirCleaned(dir: string) {
  if (!canRead(dir)) return
  return fs.promises.rmdir(dir, { recursive: true })
}

/** @private */
export function assertValidPathSegmentWithoutSpaces(p: string, msg?: string) {
  assert(/^[a-zA-Z0-9_-]+$/.test(p), `Invalid path segment: ${p}. ${msg ?? ''}`)
}
