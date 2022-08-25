import {
  AddressLabelsResult,
  MSG_GET_KNOWN_ADDRESS_LABELS,
  MSG_UPDATE_ADDRESS_LABELS,
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
      const reply = await client.request<void>(MSG_UPDATE_ADDRESS_LABELS, [
        { [accAddress]: 'renamed account' },
      ])
      assertSuccess(t, reply)
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

  t.test('kill amman', async (t) => {
    await killAmman(t, state)
    t.pass('properly killed amman')
  })
})
