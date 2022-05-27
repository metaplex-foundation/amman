import { AccountInfo, Connection, Keypair, PublicKey } from '@solana/web3.js'
import { strict as assert } from 'assert'
import { promises as fs } from 'fs'
import path from 'path'
import { fullAccountsDir } from '../utils/config'
import { ensureDir } from '../utils/fs'
import { SNAPSHOT_ACCOUNTS_DIR, SNAPSHOT_KEYPAIRS_DIR } from './consts'

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
  constructor(readonly targetDir: string, readonly connection?: Connection) {}

  // -----------------
  // Account Infos
  // -----------------
  async saveAccountInfo(
    address: PublicKey,
    accountInfo: AccountInfo<Buffer>,
    subdir?: string,
    label?: string
  ) {
    assert(!accountInfo.executable, 'Can only save non-executable accounts')

    const fulldir = subdir ? path.join(this.targetDir, subdir) : this.targetDir
    await ensureDir(fulldir)

    const accountPath = path.join(
      fulldir,
      `${label ?? address.toBase58()}.json`
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

  async saveAccount(
    address: PublicKey,
    connection?: Connection,
    data?: Buffer
  ) {
    connection = this._requireConnection(connection, 'save Account')
    const accountInfo = await connection.getAccountInfo(address, 'confirmed')
    assert(accountInfo != null, `Account not found at address ${address}`)
    if (data != null) {
      accountInfo.data = data
    }
    return this.saveAccountInfo(address, accountInfo)
  }

  // -----------------
  // Keypairs
  // -----------------
  async saveKeypair(id: string, keypair: Keypair, subdir?: string) {
    const fulldir = subdir
      ? path.join(this.targetDir, subdir, SNAPSHOT_KEYPAIRS_DIR)
      : path.join(this.targetDir, SNAPSHOT_KEYPAIRS_DIR)
    await ensureDir(fulldir)
    const keypairPath = path.join(fulldir, `${id}.json`)

    await fs.writeFile(
      keypairPath,
      JSON.stringify(Buffer.from(keypair.secretKey).toJSON().data)
    )
    return keypairPath
  }

  // -----------------
  // Snapshot
  // -----------------
  async snapshot(
    snapshotLabel: string,
    addresses: string[],
    // Keyed pubkey:label
    accountLabels: Record<string, string>,
    keypairs: Map<string, { keypair: Keypair; id: string }>,
    maybeConnection?: Connection
  ) {
    const snapshotRoot = this.targetDir
    const connection = this._requireConnection(maybeConnection, 'take snapshot')

    const snapshotDir = path.join(snapshotRoot, snapshotLabel)
    await ensureDir(snapshotDir, true)

    await Promise.all(
      addresses.map(async (address) => {
        const accountInfo = await connection.getAccountInfo(
          new PublicKey(address),
          'confirmed'
        )
        if (accountInfo == null || accountInfo.executable) return

        const subdir = path.join(snapshotLabel, SNAPSHOT_ACCOUNTS_DIR)
        return this.saveAccountInfo(
          new PublicKey(address),
          accountInfo,
          subdir,
          accountLabels[address]
        )
      })
    )
    await Promise.all(
      Array.from(keypairs.values()).map(async ({ keypair, id }) => {
        return this.saveKeypair(id, keypair, snapshotLabel)
      })
    )

    return snapshotDir
  }

  private _requireConnection(
    connection: Connection | undefined,
    task: string
  ): Connection {
    connection ??= this.connection
    assert(
      connection != null,
      `Must instantiate persister with connection or provide it to ${task}`
    )
    return connection
  }
}

export async function loadAccount(
  address: PublicKey,
  sourceDir?: string,
  label?: string
) {
  const accountPath = path.join(
    sourceDir ?? fullAccountsDir(),
    `${label ?? address.toBase58()}.json`
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
