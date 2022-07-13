import {
  MSG_REQUEST_AMMAN_VERSION,
  MSG_REQUEST_VALIDATOR_PID,
} from '@metaplex-foundation/amman-client'
import { AMMAN_VERSION } from '@metaplex-foundation/amman/dist/relay/types'
import { AmmanVersion } from '@metaplex-foundation/amman/src/relay/types'
import spok from 'spok'
import test from 'tape'
import { assertHasResult } from '../utils/asserts'
import { killAmman, launchAmman } from '../utils/launch'
import { restClient } from '../utils/rest-client'

test('rest-client: given amman is running with the relay enabled', async (t) => {
  const client = await restClient()
  const state = await launchAmman()

  t.test('fetch: amman version', async (t) => {
    const reply = await client.request<AmmanVersion>(MSG_REQUEST_AMMAN_VERSION)
    assertHasResult(t, reply)

    spok(t, reply.result, {
      $topic: 'amman version',
      ...AMMAN_VERSION,
    })
  })

  t.test('fetch: validator pid', async (t) => {
    const reply = await client.request<number>(MSG_REQUEST_VALIDATOR_PID)
    assertHasResult(t, reply)

    spok(t, reply, { $topic: 'validator pid', result: spok.gtz })
  })

  t.test('kill amman', async (t) => {
    await killAmman(t, state)
    t.pass('properly killed amman')
  })
})
