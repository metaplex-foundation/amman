import { AccountInfo, Connection, PublicKey } from '@solana/web3.js'
import path from 'path'
import { promises as fs } from 'fs'
import { strict as assert } from 'assert'
import { ensureDir } from '../utils/fs'

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
