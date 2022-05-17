import { PublicKey } from '@solana/web3.js'
import path from 'path'
import {
  getExecutableAddress,
  handleFetchAccounts,
  loadAccount,
} from '../assets'
import { fullAccountsDir } from '../utils/config'
import { canAccess } from '../utils/fs'
import { logError } from '../utils/log'
import { Account } from './types'

export async function processAccounts(
  accounts: Account[],
  accountsCluster: string,
  assetsFolder?: string,
  forceClone?: boolean
) {
  const persistedAccountInfos = []
  const accountsArgs = []
  if (accounts.length > 0) {
    const accountsFolder = fullAccountsDir(assetsFolder)

    await handleFetchAccounts(
      accountsCluster,
      accounts,
      accountsFolder,
      forceClone
    )
    for (const { accountId, executable, cluster } of accounts) {
      const accountPath = path.join(accountsFolder, `${accountId}.json`)
      if (await canAccess(accountPath)) {
        accountsArgs.push('--account')
        accountsArgs.push(accountId)
        accountsArgs.push(accountPath)

        const persistedAccountInfo = await loadAccount(
          new PublicKey(accountId),
          accountsFolder
        )
        persistedAccountInfos.push(persistedAccountInfo)
      } else {
        throw new Error(
          `Can't find account info file for account ${accountId} cloned from cluster ${
            cluster ?? accountsCluster
          }! \nMake sure the account exists locally or on that cluster and try again.`
        )
      }
      if (executable) {
        const executableId = await getExecutableAddress(accountId)
        const executablePath = path.join(accountsFolder, `${executableId}.json`)
        if (await canAccess(executablePath)) {
          accountsArgs.push('--account')
          accountsArgs.push(executableId)
          accountsArgs.push(executablePath)
        } else {
          logError(
            `Can't find executable account info file for executable account ${accountId}`
          )
        }
      }
    }
  }
  return { accountsArgs, persistedAccountInfos }
}
