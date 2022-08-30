import {
  AccountSaveResult,
  AccountStatesResult,
  MSG_REQUEST_ACCOUNT_SAVE,
  MSG_REQUEST_ACCOUNT_STATES,
} from '@metaplex-foundation/amman-client'
import path from 'path'
import spok from 'spok'
import test from 'tape'
import { assertHasError, assertHasResult } from '../utils/asserts'
import { killAmman, launchAmman } from '../utils/launch'
import { restClient } from '../utils/rest-client'

// @ts-ignore importing json module
import saved from '../../fixtures/snapshots/01_token-metadata/accounts/13DX32Lou1qH62xUosRyk9QnQpetbuxtEgPzbkKvQmVu.json'
const fixtures = path.resolve(__dirname, '../../fixtures')
const assetsDir = path.join(fixtures, 'assets')

const accAddress = saved.pubkey

test('account-states: given amman is running with relay and one loaded account', async (t) => {
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

  t.test('fetch: initial account states without passing pubkey', async (t) => {
    const reply = await client.request(MSG_REQUEST_ACCOUNT_STATES)
    assertHasError(t, reply)

    spok(t, reply, {
      status: 422,
      err: spok.test(/Need to provide the public key of the account/i),
    })
  })

  t.test('fetch: initial account states of loaded account', async (t) => {
    const reply = await client.request<AccountStatesResult>(
      MSG_REQUEST_ACCOUNT_STATES,
      [accAddress]
    )
    assertHasResult(t, reply)

    spok(t, reply, {
      result: { pubkey: accAddress, states: [] },
    })
  })

  t.test('post: save account states of loaded account', async (t) => {
    const reply = await client.request<AccountSaveResult>(
      MSG_REQUEST_ACCOUNT_SAVE,
      [accAddress]
    )
    assertHasResult(t, reply)
    spok(t, reply.result, {
      $topic: 'result',
      pubkey: accAddress,
      accountPath: spok.endsWith(`${accAddress}.json`),
    })
  })

  t.test('kill amman', async (t) => {
    await killAmman(t, state)
    t.pass('properly killed amman')
  })
})
