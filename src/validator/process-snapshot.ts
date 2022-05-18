import { promises as fs } from 'fs'
import path from 'path'
import { PersistedAccountInfo, SnapshotConfig } from '../assets'
import { logInfo, logTrace } from '../utils'
import { Account } from './types'

export async function processSnapshot(snapshotConfig: SnapshotConfig): Promise<{
  snapshotArgs: string[]
  persistedSnapshotAccountInfos: (PersistedAccountInfo & {
    label: string
    accountPath: string
  })[]
  snapshotAccounts: Account[]
}> {
  if (snapshotConfig.loadSnapshot == null) {
    return {
      snapshotArgs: [],
      persistedSnapshotAccountInfos: [],
      snapshotAccounts: [],
    }
  }

  const fullPathToSnapshotDir = path.join(
    snapshotConfig.snapshotFolder,
    snapshotConfig.loadSnapshot
  )

  const snapshotArgs = []
  const files = (await fs.readdir(fullPathToSnapshotDir)).filter(
    (x) => path.extname(x) === '.json'
  )
  const persistedSnapshotAccountInfos = await Promise.all(
    files.map(async (x) => {
      const accountPath = path.join(fullPathToSnapshotDir, x)

      const json = await fs.readFile(accountPath, 'utf8')
      const label = path.basename(x, '.json')

      const persistedAccount: PersistedAccountInfo & {
        label: string
        accountPath: string
      } = {
        ...JSON.parse(json),
        label,
        accountPath,
      }
      return persistedAccount
    })
  )

  logInfo(
    `Loading ${
      persistedSnapshotAccountInfos.length
    } accounts from snapshot at ${path.relative(
      process.cwd(),
      fullPathToSnapshotDir
    )}`
  )

  const snapshotAccounts: Account[] = []
  for (const {
    label,
    pubkey,
    accountPath,
    account,
  } of persistedSnapshotAccountInfos) {
    logTrace(`Loading account labeled ${label} with pubkey ${pubkey}`)
    snapshotArgs.push('--account')
    snapshotArgs.push(pubkey)
    snapshotArgs.push(accountPath)
    snapshotAccounts.push({
      accountId: pubkey,
      label,
      executable: account.executable,
      cluster: 'local',
    })
  }

  return {
    snapshotArgs,
    persistedSnapshotAccountInfos,
    snapshotAccounts,
  }
}
