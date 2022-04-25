import { PublicKey } from '@solana/web3.js'
import { Program } from '../validator/types'
import { spawnSync } from 'child_process'
import { logError, logInfo } from '../utils'
import { canAccess, ensureDirSync } from '../utils/fs'
import path from 'path'

export async function getExecutableAddress(programId: string): Promise<string> {
  const programPubkey = new PublicKey(programId)
  const [executableAddress] = await PublicKey.findProgramAddress(
    [programPubkey.toBytes()],
    new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111'),
  )
  return executableAddress.toString()
}

export function isValidUrl(url: string) {
  try {
    new URL(url)
  } catch (_) {
    return false
  }
  return true
}

export async function saveAccount(
  programId: string,
  endpoint: string,
  programFolder: string,
) {
  const makeEndArgs = (id: string) => ['-u', endpoint, '-o', `${programFolder}/${id}.json`, '--output', 'json']
  logInfo(`Saving program ${programId} from cluster ${endpoint}`)
  spawnSync('solana', ['account', programId, ...makeEndArgs(programId)])
  const executableId = await getExecutableAddress(programId)
  spawnSync('solana', ['account', executableId, ...makeEndArgs(executableId)])
}

export async function handleFetchPrograms(programs: Program[], programFolder: string, force = false) {
  ensureDirSync(programFolder)
  if (programs.length > 0) {
    for (const { programId, deployPath } of programs) {
      if (isValidUrl(deployPath)) {
        if (force || !(await canAccess(path.join(programFolder,`${programId}.json`)))) {
          try {
            await saveAccount(programId, deployPath, programFolder)
          } catch (err) {
            logError(`Failed to load ${programId} from cluster ${deployPath}`)
            throw err
          }
        }
      }
    }
  }
}