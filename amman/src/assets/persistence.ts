import {
  LOCALHOST,
  PersistedAccountInfo,
} from '@metaplex-foundation/amman-client'
import { AccountInfo, Connection, Keypair, PublicKey } from '@solana/web3.js'
import { strict as assert } from 'assert'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { scopedLog } from '../utils'
import { fullAccountsDir } from '../utils/config'
import { ensureDir } from '../utils/fs'
import { SNAPSHOT_ACCOUNTS_DIR, SNAPSHOT_KEYPAIRS_DIR } from './consts'
import { SnapshotConfig } from './types'

const { logDebug, logTrace } = scopedLog('persist')

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

    return this.savePersistedAccountInfo(persistedAccount, subdir, label)
  }

  async savePersistedAccountInfo(
    persistedAccount: PersistedAccountInfo,
    subdir?: string,
    label?: string
  ) {
    logTrace('Saving account info', persistedAccount.pubkey, label ?? '')
    logTrace(persistedAccount)
    assert(
      !persistedAccount.account.executable,
      'Can only save non-executable accounts'
    )
    const fulldir = subdir ? path.join(this.targetDir, subdir) : this.targetDir
    await ensureDir(fulldir)

    const accountPath = path.join(
      fulldir,
      `${label ?? persistedAccount.pubkey}.json`
    )

    await fs.writeFile(accountPath, JSON.stringify(persistedAccount, null, 2))
    return accountPath
  }

  async saveAccount(
    address: PublicKey,
    connection?: Connection,
    data?: Buffer
  ) {
    connection = this._requireConnection('save Account', connection)
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
    logTrace('Saving keypair', id)
    const fulldir = subdir
      ? path.join(this.targetDir, subdir, SNAPSHOT_KEYPAIRS_DIR)
      : path.join(this.targetDir, SNAPSHOT_KEYPAIRS_DIR)
    await ensureDir(fulldir)
    const keypairPath = path.join(fulldir, `${id}.json`)

    const json = JSON.stringify(Array.from(keypair.secretKey))
    await fs.writeFile(keypairPath, json, 'utf8')
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
    accountOverrides: Map<string, PersistedAccountInfo> = new Map()
  ) {
    const snapshotRoot = this.targetDir
    const connection = this._requireConnection('take snapshot')

    const snapshotDir = path.join(snapshotRoot, snapshotLabel)
    await ensureDir(snapshotDir, true)

    const subdir = path.join(snapshotLabel, SNAPSHOT_ACCOUNTS_DIR)

    // 1. Save acconuts with known addresses
    await Promise.all(
      addresses
        // We are saving overrides below
        .filter((address) => !accountOverrides.has(address))
        .map(async (address) => {
          // Save account info we pull from the validator
          const accountInfo = await connection.getAccountInfo(
            new PublicKey(address),
            'confirmed'
          )
          if (accountInfo == null || accountInfo.executable) return

          return this.saveAccountInfo(
            new PublicKey(address),
            accountInfo,
            subdir,
            accountLabels[address]
          )
        })
    )

    // 2. Save account overrides
    await Promise.all(
      Array.from(accountOverrides.values()).map((override) => {
        logTrace('Saving override account info %s', override.pubkey)
        return this.savePersistedAccountInfo(
          override,
          subdir,
          accountLabels[override.pubkey]
        )
      })
    )

    // 3. Save keypairs
    const seenKeypairIds = new Set<string>()
    await Promise.all(
      Array.from(keypairs.values()).map(async ({ keypair, id }) => {
        // The client ensures that keypair ids don't collide, but we add this
        // extra check here in order to guard against corrupted keypair files
        // due to being written to at the same time (filenames are ids)
        if (seenKeypairIds.has(id)) return
        seenKeypairIds.add(id)
        return this.saveKeypair(id, keypair, snapshotLabel)
      })
    )

    return snapshotDir
  }

  private _requireConnection(
    task: string,
    connection?: Connection
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
  logTrace('Loading account', address.toBase58(), label ?? '')
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

export async function createTemporarySnapshot(
  addresses: string[],
  // Keyed pubkey:label
  accountLabels: Record<string, string>,
  keypairs: Map<string, { keypair: Keypair; id: string }>,
  accountOverrides: Map<string, PersistedAccountInfo> = new Map()
) {
  logDebug('Creating temporary snapshot')
  logTrace(accountOverrides)

  const label = 'temporary'
  const snapshotFolder = path.join(tmpdir(), 'amman-snapshots')
  const config: SnapshotConfig = {
    snapshotFolder,
    load: label,
  }
  const persister = new AccountPersister(
    snapshotFolder,
    new Connection(LOCALHOST, 'confirmed')
  )
  const snapshotDir = await persister.snapshot(
    label,
    addresses,
    accountLabels,
    keypairs,
    accountOverrides
  )

  function cleanupSnapshotDir() {
    return fs.rm(snapshotDir, { recursive: true })
  }

  return { config, cleanupSnapshotDir }
}
