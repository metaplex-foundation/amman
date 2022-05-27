import { strict as assert } from 'assert'

/** @private */
export function assertValidPathSegmentWithoutSpaces(p: string, msg?: string) {
  assert(/^[a-zA-Z0-9_-]+$/.test(p), `Invalid path segment: ${p}. ${msg ?? ''}`)
}
