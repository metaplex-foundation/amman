import {
  commitments,
  isValidAddress,
  LOCALHOST,
  logDebug,
  logInfo,
} from '../../utils'
import path from 'path'
import { strict as assert } from 'assert'
import { keypairFromFile } from '../../utils/fs'
import { Commitment, Connection, PublicKey } from '@solana/web3.js'
import { Amman } from '../../api'

export async function handleAirdropCommand(
  pubKeyOrPathToKeypairFile: string,
  amount: number,
  commitment: Commitment
) {
  let keystring = pubKeyOrPathToKeypairFile

  if (!isValidAddress(pubKeyOrPathToKeypairFile)) {
    logDebug(`Resolving public key from file: ${pubKeyOrPathToKeypairFile}`)
    assert(
      path.extname(pubKeyOrPathToKeypairFile) === '.json',
      'Argument to airdrop needs to be a PublicKey string or a path to a keypair JSON file'
    )

    const fullPath = path.resolve(pubKeyOrPathToKeypairFile)
    const keypair = await keypairFromFile(fullPath)
    keystring = keypair.publicKey.toBase58()
  }

  const connection = new Connection(LOCALHOST, commitment)
  const amman = Amman.instance({
    ammanClientOpts: { autoUnref: false, ack: true },
  })
  // amman.addr.addLabel('payer', keystring)

  logInfo(`Airdropping ${amount} Sol to account '${keystring}'`)
  return amman.airdrop(connection, new PublicKey(keystring), amount)
}

export function airdropHelp() {
  return `
Airdrops provided Sol to the provided public key.

  Usage:
    amman airdrop <amount> <public key or path to keypair file>

  Options:
    --commitment=${commitments.join('|')} [default: singleGossip]
      The commitment to use for Airdrop transaction

  Examples:
    amman airdrop 100 DTTTQyKBNPDFa3cHfFJwDWcNPRJgemSisyWaohFbMRPi
    amman airdrop 100 ./keypairs/payer.json
`
}
