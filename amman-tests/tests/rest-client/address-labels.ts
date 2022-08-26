import {
  AddressLabelsResult,
  LoadKeypairResult,
  MSG_GET_KNOWN_ADDRESS_LABELS,
  MSG_REQUEST_LOAD_KEYPAIR,
  MSG_REQUEST_STORE_KEYPAIR,
  MSG_UPDATE_ADDRESS_LABELS,
  VoidResult,
} from '@metaplex-foundation/amman-client'
import path from 'path'
import spok from 'spok'
import test from 'tape'
import {
  assertHasError,
  assertHasResult,
  assertSuccess,
} from '../utils/asserts'
import { killAmman, launchAmman } from '../utils/launch'
import { restClient } from '../utils/rest-client'

// @ts-ignore importing json module
import saved from '../../fixtures/snapshots/01_token-metadata/accounts/13DX32Lou1qH62xUosRyk9QnQpetbuxtEgPzbkKvQmVu.json'
import { Keypair } from '@solana/web3.js'
import { keypairSecretFromObject } from '@metaplex-foundation/amman-client'
const fixtures = path.resolve(__dirname, '../../fixtures')
const assetsDir = path.join(fixtures, 'assets')

const accAddress = saved.pubkey

test('amman-client: given amman is running with relay and one loaded account', async (t) => {
  const client = await restClient()
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

  t.test('fetch: initial address labels', async (t) => {
    const reply = await client.request<AddressLabelsResult>(
      MSG_GET_KNOWN_ADDRESS_LABELS
    )
    assertHasResult(t, reply)

    spok(t, reply.result, {
      $topic: 'result',
      labels: {
        [accAddress]: 'loaded account',
      },
    })
  })

  t.test('fetch: update address labels without passing any', async (t) => {
    const reply = await client.request(MSG_UPDATE_ADDRESS_LABELS)
    assertHasError(t, reply)

    spok(t, reply, {
      status: 422,
      err: spok.test(/Need to provide a record of address labels to update/i),
    })
  })

  t.test(
    'fetch: update address labels to update the loaded account',
    async (t) => {
      const reply = await client.request<VoidResult>(
        MSG_UPDATE_ADDRESS_LABELS,
        [{ [accAddress]: 'renamed account' }]
      )
      assertHasResult(t, reply)
    }
  )

  t.test('fetch: address labels again', async (t) => {
    const reply = await client.request<AddressLabelsResult>(
      MSG_GET_KNOWN_ADDRESS_LABELS
    )
    assertHasResult(t, reply)

    spok(t, reply.result, {
      $topic: 'result',
      labels: {
        [accAddress]: 'renamed account',
      },
    })
  })

  // -----------------
  // Store Keypair
  // -----------------
  const keypair = Keypair.generate()
  const keypairId = keypair.publicKey.toBase58()
  t.test('post: store keypair', async (t) => {
    const reply = await client.request<VoidResult>(MSG_REQUEST_STORE_KEYPAIR, [
      keypairId,
      keypair.secretKey,
    ])
    assertHasResult(t, reply)
  })

  t.test('fetch: keypair we did not store', async (t) => {
    const unstoredPair = Keypair.generate()
    const unstoredId = unstoredPair.publicKey.toBase58()
    const reply = await client.request<LoadKeypairResult>(
      MSG_REQUEST_LOAD_KEYPAIR,
      [unstoredId]
    )
    assertHasResult(t, reply)
    t.equal(reply.result.id, unstoredId, 'returns passed id')
    t.notOk(reply.result.keypair, 'returns no keypair')
  })

  t.test('fetch: stored keypair', async (t) => {
    const reply = await client.request<LoadKeypairResult>(
      MSG_REQUEST_LOAD_KEYPAIR,
      [keypairId]
    )
    assertHasResult(t, reply)
    const secretKeyArray = keypairSecretFromObject(reply.result.keypair!)
    const replyPair = Keypair.fromSecretKey(secretKeyArray)
    t.equal(reply.result.id, keypairId, 'returns passed id')
    t.equal(
      replyPair.publicKey.toBase58(),
      keypairId,
      'returns resolved keypair'
    )
  })

  t.test('kill amman', async (t) => {
    await killAmman(t, state)
    t.pass('properly killed amman')
  })
})
