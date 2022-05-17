import { AccountInfo, Connection, PublicKey } from '@solana/web3.js'
import path from 'path'
import { promises as fs } from 'fs'
import { ensureDir } from '../utils/fs'
import { fullAccountsDir } from '../utils/config'
import { strict as assert } from 'assert'

export type PersistedAccountInfo = {
  pubkey: string
  account: {
    lamports: number
    data: [string, 'base64']
    owner: string
    executable: boolean
    rentEpoch: number
  }
}

export class AccountPersister {
  constructor(
    readonly connection: Connection,
    readonly accountsFolder: string
  ) {}

  async saveAccountInfo(address: PublicKey, accountInfo: AccountInfo<Buffer>) {
    assert(!accountInfo.executable, 'Can only save non-executable accounts')

    await ensureDir(this.accountsFolder)
    const accountPath = path.join(
      this.accountsFolder,
      `${address.toBase58()}.json`
    )
    const persistedAccount: PersistedAccountInfo = {
      pubkey: address.toBase58(),
      account: {
        lamports: accountInfo.lamports,
        data: [accountInfo.data.toString('base64'), 'base64'],
        owner: accountInfo.owner.toBase58(),
        executable: accountInfo.executable,
        rentEpoch: accountInfo.rentEpoch ?? 0,
      },
    }

    await fs.writeFile(accountPath, JSON.stringify(persistedAccount, null, 2))
    return accountPath
  }

  async saveAccount(address: PublicKey) {
    const accountInfo = await this.connection.getAccountInfo(
      address,
      'confirmed'
    )
    assert(accountInfo != null, `Account not found at address ${address}`)
    return this.saveAccountInfo(address, accountInfo)
  }
}

export async function loadAccount(address: PublicKey, accountsFolder?: string) {
  const accountPath = path.join(
    accountsFolder ?? fullAccountsDir(),
    `${address.toBase58()}.json`
  )
  const json = await fs.readFile(accountPath, 'utf8')
  const persistedAccount: PersistedAccountInfo = JSON.parse(json)
  return persistedAccount
}

export function accountInfoFromPersisted(persisted: PersistedAccountInfo): {
  address: string
  accountInfo: AccountInfo<Buffer>
} {
  const { executable, owner, data, lamports } = persisted.account
  assert.equal(
    data[1],
    'base64',
    'expected persisted account info data to be encoded as "base64"'
  )
  const accountInfo: AccountInfo<Buffer> = {
    lamports,
    data: Buffer.from(data[0], 'base64'),
    owner: new PublicKey(owner),
    executable,
  }
  return { address: persisted.pubkey, accountInfo }
}

export function mapPersistedAccountInfos(
  persisteds: PersistedAccountInfo[]
): Map<string, AccountInfo<Buffer>> {
  const map = new Map()
  for (const persisted of persisteds) {
    const { address, accountInfo } = accountInfoFromPersisted(persisted)
    map.set(address, accountInfo)
  }
  return map
}
