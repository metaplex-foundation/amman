import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { LOCALHOST } from '../../utils'
import { strict as assert } from 'assert'
import { bold, dim } from 'ansi-colors'
// @ts-ignore no types available, but it's a simpler function
import hexdump from 'buffer-hexdump'

import format from 'date-fns/format'
import formatDistance from 'date-fns/formatDistance'

import table from 'text-table'
import { cliAmmanInstance, resolveAccountAddresses } from '../utils'
import { printableAccount } from '../../accounts/state'

export async function handleAccountCommand(
  acc: string | undefined,
  includeTxs: boolean = false
) {
  if (acc == null) return renderAllKnownAccounts(includeTxs)

  const amman = cliAmmanInstance()
  const addresses = await resolveAccountAddresses(amman, acc)
  if (addresses.length === 0) {
    throw new Error(`Account ${acc} could not be resolved to an address`)
  }

  const connection = new Connection(LOCALHOST, 'singleGossip')
  const rendereds = []
  for (const address of addresses) {
    const pubkey = new PublicKey(address)
    const accountInfo = await connection.getAccountInfo(pubkey)
    assert(accountInfo != null, 'Account info should not be null')
    const len = accountInfo.data.length
    const sol = accountInfo.lamports / LAMPORTS_PER_SOL

    const accountStates = await tryResolveAccountStates(pubkey)
    const rawData =
      accountStates == null || accountStates.length === 0
        ? `\n${hexdump(accountInfo.data)}`
        : dim(' (raw data omitted)')

    const rendered = `
${bold('Public Key')}: ${address}
${bold('Balance   ')}: ${sol} SOL
${bold('Owner     ')}: ${accountInfo.owner}
${bold('Executable')}: ${accountInfo.executable}
${bold('Rent Epoch')}: ${accountInfo.rentEpoch}
Length: ${len} (0x${len.toString(16)}) bytes${rawData}
${accountStates}
`
    rendereds.push(rendered)
  }

  let rendered = rendereds.join(
    '\n==================================================================\n'
  )
  if (rendereds.length > 1) {
    rendered +=
      `\n${bold('NOTE')}: found ${rendereds.length}` +
      ` accounts labeled '${acc}' and printed all of them above`
  }
  amman.disconnect()
  return { connection, rendered }
}

async function renderAllKnownAccounts(includeTxs: boolean) {
  const amman = cliAmmanInstance()
  const accounts = await amman.addr.getRemoteLabelAddresses()
  if (Object.keys(accounts).length === 0) {
    const rendered = 'No labeled accounts found'
    return { connection: undefined, rendered }
  }

  const rows = []
  for (const [address, label] of Object.entries(accounts)) {
    if (!includeTxs && address.length > 44) continue
    rows.push([bold(label), address])
  }
  const rendered = table(rows)
  amman.disconnect()
  return { connection: undefined, rendered }
}

async function tryResolveAccountStates(pubkey: PublicKey) {
  const amman = cliAmmanInstance()
  const states = await amman.ammanClient.fetchAccountStates(pubkey.toBase58())
  if (states == null) return

  let statesStr = ''
  for (let i = states.length - 1; i >= 0; i--) {
    const state = states[i]
    const rows: any[] = []

    const printable = printableAccount(state.account)
    for (const [key, value] of Object.entries(printable)) {
      rows.push([key, dim(value ?? 'null')])
    }
    const tdelta = formatDistance(state.timestamp, Date.now(), {
      includeSeconds: true,
      addSuffix: true,
    })
    const ts = format(state.timestamp, 'HH:mm:ss:SSS')
    const time = dim(`${tdelta} at ${ts} in slot ${state.slot}`)
    statesStr +=
      `\n${bold('Account State')} ${time}` +
      `\n${bold('-------------')}` +
      `\n${table(rows)}`
    if (state.rendered != null) {
      statesStr += `\n${state.rendered}`
    }
  }
  return statesStr
}
