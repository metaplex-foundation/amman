import { KILL_AMMAN_EXIT_CODE } from '@metaplex-foundation/amman-client/src/amman-client'
import spok from 'spok'
import test from 'tape'
import { launchAmman, relayClient } from '../../utils/launch'

// NOTE: that this test ends up killing the whole process since amman is
// running inside of it, thus killing amman kills the tests
// As long as the test files are run one by one this isn't a problem since the
// test that ends up killing this process is the last one.

test('amman-client: given amman is running with the relay enabled', async (t) => {
  const client = relayClient()
  await launchAmman()

  t.test('fetch: validator pid', async (t) => {
    const pid = await client.fetchValidatorPid()
    spok(t, { pid }, { $topic: 'validator pid', pid: spok.gtz })
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
      await client.requestKillAmman()
    } catch (err: any) {
      t.fail(err)
    }
  })
})
