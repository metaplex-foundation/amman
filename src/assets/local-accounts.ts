import { PublicKey } from '@solana/web3.js'
import { Account } from '../validator/types'
import { spawnSync } from 'child_process'
import { logError, logInfo } from '../utils'
import { canAccess, ensureDirSync } from '../utils/fs'
import path from 'path'

export async function getExecutableAddress(programId: string): Promise<string> {
  const programPubkey = new PublicKey(programId)
  const [executableAddress] = await PublicKey.findProgramAddress(
    [programPubkey.toBytes()],
    new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111')
  )
  return executableAddress.toString()
}

export async function saveAccount(
  accountId: string,
  endpoint: string,
  accountsFolder: string,
  executable = false
) {
  const makeEndArgs = (id: string) => [
    '-u',
    endpoint,
    '-o',
    `${accountsFolder}/${id}.json`,
    '--output',
    'json',
  ]
  logInfo(`Saving account ${accountId} from cluster ${endpoint}`)
  spawnSync('solana', ['account', accountId, ...makeEndArgs(accountId)])
  if (executable) {
    logInfo(`Saving executable data for ${accountId} from cluster ${endpoint}`)
    const executableId = await getExecutableAddress(accountId)
    spawnSync('solana', ['account', executableId, ...makeEndArgs(executableId)])
  }
}

export async function handleFetchAccounts(
  accountsCluster: string,
  accounts: Account[],
  accountsFolder: string,
  force = false
) {
  ensureDirSync(accountsFolder)
  if (accounts.length > 0) {
    for (const { accountId, cluster, executable } of accounts) {
      if (!accountId || accountId.length !== 32) {
        logError(`Account ID ${accountId} in accounts array from validator config is invalid`)
        throw new Error("Invalid account ID in accounts array")
      }
      if (
        force ||
        !(await canAccess(path.join(accountsFolder, `${accountId}.json`)))
      ) {
        const endpoint = cluster ?? accountsCluster
        try {
          await saveAccount(accountId, endpoint, accountsFolder, executable)
        } catch (err) {
          logError(`Failed to load ${accountId} from cluster ${endpoint}`)
          throw err
        }
      }
    }
  }
}
