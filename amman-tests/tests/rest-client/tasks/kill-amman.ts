import {
  MSG_REQUEST_KILL_AMMAN,
  MSG_REQUEST_VALIDATOR_PID,
} from '@metaplex-foundation/amman-client'
import { KILL_AMMAN_EXIT_CODE } from '@metaplex-foundation/amman-client/src/amman-client'
import spok from 'spok'
import test from 'tape'
import { assertHasResult } from '../../utils/asserts'
import { launchAmman } from '../../utils/launch'
import { restClient } from '../../utils/rest-client'

// NOTE: that this test ends up killing the whole process since amman is
// running inside of it, thus killing amman kills the tests
// As long as the test files are run one by one this isn't a problem since the
// test that ends up killing this process is the last one.

test('amman-client: given amman is running with the relay enabled', async (t) => {
  const client = await restClient()
  await launchAmman()

  t.test('fetch: validator pid', async (t) => {
    const reply = await client.request<number>(MSG_REQUEST_VALIDATOR_PID)
    assertHasResult(t, reply)

    spok(t, reply, { $topic: 'validator pid', result: spok.gtz })
  })

  t.test('request to kill amman', async (t) => {
    process.on('exit', (code) => {
      t.equal(
        code,
        KILL_AMMAN_EXIT_CODE,
        'exits process with kill amman exit code'
      )
    })
    try {
      await client.request<number>(MSG_REQUEST_KILL_AMMAN)
    } catch (err: any) {
      t.fail(err)
    }
  })
})
