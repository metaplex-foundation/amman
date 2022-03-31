import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { Amman } from '../../api'
import { isValidPublicKeyAddress, LOCALHOST } from '../../utils'
import { strict as assert } from 'assert'
import { bold } from 'ansi-colors'
// @ts-ignore
import hexdump from 'buffer-hexdump'

export async function handleAccountCommand(acc: string) {
  const address = await resolveAccountAddress(acc)
  if (address == null) {
    throw new Error(`Account ${acc} could not be resolved to an address`)
  }

  const connection = new Connection(LOCALHOST, 'singleGossip')
  const accountInfo = await connection.getAccountInfo(new PublicKey(address))
  assert(accountInfo != null, 'Account info should not be null')
  const len = accountInfo.data.length
  const sol = accountInfo.lamports / LAMPORTS_PER_SOL
  return `
${bold('Public Key')}: ${address}
${bold('Balance   ')}: ${sol} SOL
${bold('Owner     ')}: ${accountInfo.owner}
${bold('Executable')}: ${accountInfo.executable}
${bold('Rent Epoch')}: ${accountInfo.rentEpoch}
Length: ${len} (0x${len.toString(16)}) bytes
${hexdump(accountInfo.data)}
`
}

async function resolveAccountAddress(acc: string) {
  if (isValidPublicKeyAddress(acc)) return acc
  const amman = Amman.instance({
    ammanClientOpts: { autoUnref: false, ack: true },
  })
  const resolved = await amman.addr.resolveRemote(acc)
  amman.disconnect()
  return resolved
}
