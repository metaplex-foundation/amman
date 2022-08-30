import {
  MSG_REQUEST_RESTART_VALIDATOR,
  MSG_REQUEST_VALIDATOR_PID,
} from '@metaplex-foundation/amman-client'
import spok from 'spok'
import test from 'tape'
import { assertHasResult, assertSuccess } from '../../utils/asserts'
import { killAmman, launchAmman } from '../../utils/launch'
import { restClient } from '../../utils/rest-client'

test('rest-client: restart-validator', async (t) => {
  const client = await restClient()
  const state = await launchAmman()

  let pidBeforeRestart: number

  t.test('fetch: validator pid', async (t) => {
    const reply = await client.request<number>(MSG_REQUEST_VALIDATOR_PID)
    assertHasResult(t, reply)

    spok(t, reply, { $topic: 'validator pid', result: spok.gtz })
    pidBeforeRestart = reply.result as number
  })

  t.test('request to restart validator', async (t) => {
    const reply = await client.request<void>(MSG_REQUEST_RESTART_VALIDATOR)
    assertSuccess(t, reply)
  })

  t.test('fetch: validator pid after restart', async (t) => {
    const reply = await client.request<number>(MSG_REQUEST_VALIDATOR_PID)
    assertHasResult(t, reply)

    spok(t, reply, { $topic: 'validator pid', result: spok.gtz })

    t.notEqual(
      reply.result,
      pidBeforeRestart,
      'a new validator with different pid has started up'
    )
  })

  t.test('kill amman', async (t) => {
    await killAmman(t, state)
    t.pass('properly killed amman')
  })
})
