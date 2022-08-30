import path from 'path'

import test from 'tape'
import { LOCALHOST } from '@metaplex-foundation/amman-client'
import { killAmman, launchAmman } from '../utils/launch'

import { AccountInfo, Connection, PublicKey } from '@solana/web3.js'
// @ts-ignore importing json module
import saved from '../../fixtures/snapshots/01_token-metadata/accounts/13DX32Lou1qH62xUosRyk9QnQpetbuxtEgPzbkKvQmVu.json'

const fixtures = path.resolve(__dirname, '../../fixtures')
const assetsDir = path.join(fixtures, 'assets')

const accAddress = saved.pubkey
const accPubkey = new PublicKey(accAddress)

test('amman-client: given amman + relay is running and assets folder set + validator configured to load an account', async (t) => {
  const state = await launchAmman({
    assetsFolder: assetsDir,
    validator: {
      accounts: [
        {
          label: 'loaded account',
          accountId: accAddress,
        },
      ],
    },
  })
  const connection = new Connection(LOCALHOST, 'confirmed')

  t.test(
    'loads account provided account which then is accessible in the validator',
    async (t) => {
      const account = (await connection.getAccountInfo(
        accPubkey
      )) as AccountInfo<Buffer>
      const savedAcc = saved.account
      t.ok(account != null, 'finds account')
      t.equal(account.lamports, savedAcc.lamports, 'lamports match')
      t.equal(account.owner.toBase58(), savedAcc.owner, 'owner match')
      t.equal(account.executable, savedAcc.executable, 'executable match')
      t.equal(
        Buffer.from(account.data).toString('base64'),
        savedAcc.data[0],
        'data match'
      )
    }
  )

  t.test('kill amman', async (t) => {
    await killAmman(t, state)
    t.pass('properly killed amman')
  })
})
