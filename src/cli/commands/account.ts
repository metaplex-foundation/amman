import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { LOCALHOST } from '../../utils'
import { strict as assert } from 'assert'
import { bold, dim } from 'ansi-colors'
// @ts-ignore no types available, but it's a simpler function
import hexdump from 'buffer-hexdump'

import table from 'text-table'
import { AccountProvider } from '../../accounts/providers'
import { resolveAccountAddress } from '../utils'

export async function handleAccountCommand(acc: string) {
  const address = await resolveAccountAddress(acc)
  if (address == null) {
    throw new Error(`Account ${acc} could not be resolved to an address`)
  }

  const connection = new Connection(LOCALHOST, 'singleGossip')
  const pubkey = new PublicKey(address)
  const accountInfo = await connection.getAccountInfo(pubkey)
  assert(accountInfo != null, 'Account info should not be null')
  const len = accountInfo.data.length
  const sol = accountInfo.lamports / LAMPORTS_PER_SOL

  const accountData = (await tryResolveAccountData(pubkey)) ?? ''

  const rendered = `
${bold('Public Key')}: ${address}
${bold('Balance   ')}: ${sol} SOL
${bold('Owner     ')}: ${accountInfo.owner}
${bold('Executable')}: ${accountInfo.executable}
${bold('Rent Epoch')}: ${accountInfo.rentEpoch}
Length: ${len} (0x${len.toString(16)}) bytes
${hexdump(accountInfo.data)}
${accountData}
`
  return { connection, rendered }
}

async function tryResolveAccountData(pubkey: PublicKey) {
  const accountProvider = AccountProvider.fromRecord({}, new Map())
  const res = await accountProvider.syncAccountInformation(pubkey)
  const pretty = res?.account?.pretty()
  if (pretty == null) return

  const rows: any[] = []

  for (const [key, value] of Object.entries(pretty)) {
    rows.push([key, dim(value ?? 'null')])
  }
  return (
    `\n${bold('Account Data')}` +
    `\n${bold('------------')}` +
    `\n${table(rows)}`
  )
}
