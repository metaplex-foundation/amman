// NOTE: this is all disabled for now since saving a snapshot and then
// restarting amman turned out to be non-trivial. Part of it is that taking all
// things offline including the faucet is slow.
// However the bigger part is that the web3.js Connection cannot be properly
// closed an thus keeps attempting to connect to the killed sonala test
// validator.
//
// Trying to create a new Connection to connect to the newly launched validator
// failed due to requests to accounts never resolving (see last test).
// However I'm leaving this code here as is in order to hopefully fix it later
// and/or to use it to just generate snapshots to use for other tests.

import spok from 'spok'
import test from 'tape'
import { Amman, LOCALHOST } from '@metaplex-foundation/amman-client'
import { killAmman, launchAmman, relayClient } from '../../utils/launch'

import os from 'os'
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { AmmanState } from '@metaplex-foundation/amman/src/validator/types'

const tmpdir = os.tmpdir()
const address = 'A15Y2eoMNGeX4516TYTaaMErwabCrf9AB9mrzFohdQJz'
const pubkey = new PublicKey(address)

const DISABLED = true

if (!DISABLED) {
  test('amman-client: given amman + relay is running and snapshot folder configured', async (t) => {
    const client = relayClient()
    let state: AmmanState

    const amman = Amman.instance()
    const SOL = 666

    t.test('airdrop: start amman', async (_) => {
      state = await launchAmman({
        snapshot: { snapshotFolder: tmpdir },
      })
    })

    t.test('airdrop: to the payer', async (t) => {
      let connection: Connection | null = new Connection(LOCALHOST, 'confirmed')
      const { signature } = await amman.airdrop(connection, pubkey, SOL)
      t.ok(signature.length >= 87, 'completes with valid transaction signature')

      const account = await connection.getAccountInfo(pubkey, 'confirmed')
      t.equal(
        account?.lamports,
        LAMPORTS_PER_SOL * SOL,
        'account now exists with the airdropped Sol'
      )
      connection = null
    })

    t.test('request: save snapshot labeled "testsnap"', async (t) => {
      const snapshotDir = await client.requestSnapshot('testsnap')
      spok(
        t,
        { $topic: 'snapshot dir', snapshotDir },
        { snapshotDir: spok.startsWith(tmpdir) }
      )
    })

    t.test('kill amman', async (t) => {
      await killAmman(t, state)
      t.pass('properly killed amman')
    })

    t.test(
      'starting amman fresh the airdropped account does not exist',
      async (_) => {
        state = await launchAmman({
          snapshot: { snapshotFolder: tmpdir },
        })
        console.log('getting account info again')
        const connection = new Connection(LOCALHOST, 'confirmed')
        // NOTE: this never resolves
        const account = await connection.getAccountInfo(pubkey, 'confirmed')
        console.log(account)
      }
    )
  })
}
