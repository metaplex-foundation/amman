import { AMMAN_VERSION } from '@metaplex-foundation/amman/src/relay/types'
import spok from 'spok'
import test from 'tape'
import { killAmman, launchAmman, relayClient } from './utils/launch'

const DEBUG = true

test('amman-client: amman version', async (t) => {
  const client = relayClient()

  const state = await launchAmman({ streamTransactionLogs: DEBUG })
  {
    const version = await client.fetchAmmanVersion()
    spok(t, version, { $topic: 'amman version', ...AMMAN_VERSION })
  }
  await killAmman(t, state)
  t.end()
})
