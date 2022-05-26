import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { LOCALHOST } from '../../utils'
import { strict as assert } from 'assert'
import { bold, dim, blueBright, green } from 'ansi-colors'
// @ts-ignore no types available, but it's a simpler function
import hexdump from 'buffer-hexdump'

import format from 'date-fns/format'
import formatDistance from 'date-fns/formatDistance'

import table from 'text-table'
import { cliAmmanInstance, resolveAccountAddresses } from '../utils'
import { printableAccount } from '../../accounts/state'

export async function handleAccountCommand(
  acc: string | undefined,
  includeTxs: boolean,
  save: boolean
): Promise<{
  connection?: Connection | undefined
  rendered: string
  savedAccountPath?: string | undefined
}> {
  if (acc == null) return renderAllKnownAccounts(includeTxs)

  const amman = cliAmmanInstance()
  const addresses = await resolveAccountAddresses(amman, acc)
  if (addresses.length === 0) {
    throw new Error(`Account ${acc} could not be resolved to an address`)
  }
  if (save && addresses.length > 1) {
    throw new Error(
      `Account ${acc} could not be resolved to exactly address and thus cannot be saved`
    )
  }
  const connection = new Connection(LOCALHOST, 'confirmed')
  const rendereds = []
  let savedAccountPath
  for (const address of addresses) {
    const pubkey = new PublicKey(address)
    const accountInfo = await connection.getAccountInfo(pubkey)
    assert(accountInfo != null, 'Account info should not be null')

    if (save) {
      savedAccountPath = await amman.ammanClient.requestSaveAccount(
        addresses[0]
      )
    }
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
  return { connection, rendered, savedAccountPath }
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
    rows.push([label, dim(address)])
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
  for (let i = 0; i < states.length; i++) {
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

    const diffRows: [string, string, string][] =
      state.accountDiff
        ?.map((x) => {
          if (x.kind === 'E') {
            return [x.path, x.lhs, x.rhs]
          } else if (x.kind === 'N') {
            return [x.path, '+', x.rhs]
          } else if (x.kind === 'D') {
            return [x.path, '-', x.lhs]
          } else {
            return [x.path, 'item at idx changed', x.index.toString()]
          }
        })
        .map(([p, c, v]) => {
          const sp: string =
            p == null
              ? ''
              : Array.isArray(p)
              ? p.join('.')
              : typeof p === 'string'
              ? p
              : JSON.stringify(p, null, 2)
          const sc = typeof c === 'string' ? c : JSON.stringify(c)
          const sv = typeof v === 'string' ? v : JSON.stringify(v)
          return [sp, dim(sc), dim(sv)]
        }) ?? []
    const diffRendered = diffRows.length > 0 ? table(diffRows) : undefined

    const n = (i + 1).toString().padStart(2, '0')
    statesStr +=
      `\n${bold('Account State')} ${n} ${time}` +
      `\n${bold('----------------')}` +
      `\n${table(rows)}\n`
    if (diffRendered != null) {
      // prettier-ignore
      statesStr +=
        `\n${bold('Diffs')}` +
        `\n${bold('-----')}` +
        `\n${diffRendered}\n`
    }
    if (state.rendered != null) {
      // prettier-ignore
      statesStr += 
        `\n${bold('Rendered')}` +
        `\n${bold('--------')}`
      if (state.renderedDiff != null && state.renderedDiff.length > 0) {
        statesStr += `\n${renderDiff(state.renderedDiff)}`
      } else {
        statesStr += `\n${state.rendered}`
      }
    }
  }
  return statesStr
}

function renderDiff(renderedDiff?: Diff.Change[]) {
  if (renderedDiff == null || renderedDiff.length === 0) return
  const before = renderedDiff
    .map((x) => {
      if (x.added) return ''
      const fn = x.removed ? blueBright : undefined
      return fn == null ? x.value : fn(x.value)
    })
    .join('')
  const after = renderedDiff
    .map((x) => {
      if (x.removed) return ''
      const fn = x.added ? green : undefined
      return fn == null ? x.value : fn(x.value)
    })
    .join('')
  return `\n${dim('# Before')}\n${before}\n${dim('# After')}\n${after}`
}
