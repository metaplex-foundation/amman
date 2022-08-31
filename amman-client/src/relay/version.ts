import { AmmanVersion } from './types'

export const MIN_AMMAN_CLI_VERSION_REQUIRED: AmmanVersion =
  require('../../package.json')
    .minAmmanCliVersion.split('.')
    .map((v: string) => parseInt(v))

export function requiredVersionSatisfied(version: AmmanVersion): boolean {
  const minVersion = MIN_AMMAN_CLI_VERSION_REQUIRED
  if (version[0] > minVersion[0]) return true
  if (version[0] < minVersion[0]) return false
  if (version[1] > minVersion[1]) return true
  if (version[1] < minVersion[1]) return false
  return version[2] >= version[2]
}

export function versionString(version: AmmanVersion): string {
  return `v${version[0]}.${version[1]}.${version[2]}`
}

export const ENSURE_VERSION = `Make sure to use amman cli version >=${versionString(
  MIN_AMMAN_CLI_VERSION_REQUIRED
)} by updating amman updating it from npm:\nhttps://www.npmjs.com/package/@metaplex-foundation/amman\n`
