import { AMMAN_VERSION } from '@metaplex-foundation/amman/src/relay/types'
import spok from 'spok'
import test from 'tape'
import { killAmman, launchAmman, relayClient } from '../utils/launch'

const DEBUG = true

test('amman-client: given amman is running with the relay enabled', async (t) => {
  const client = relayClient()
  const state = await launchAmman({ streamTransactionLogs: DEBUG })

  t.test('fetch: amman version', async (t) => {
    const version = await client.fetchAmmanVersion()
    spok(t, version, { $topic: 'amman version', ...AMMAN_VERSION })
  })

  t.test('fetch: validator pid', async (t) => {
    const pid = await client.fetchValidatorPid()
    spok(t, { pid }, { $topic: 'validator pid', pid: spok.gtz })
  })

  t.test('kill amman', async (t) => {
    await killAmman(t, state)
    t.pass('properly killed amman')
  })
})
