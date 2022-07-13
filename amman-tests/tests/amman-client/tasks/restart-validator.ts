import spok from 'spok'
import test from 'tape'
import { killAmman, launchAmman, relayClient } from '../../utils/launch'

test('amman-client: given amman is running with the relay enabled', async (t) => {
  const client = relayClient()
  const state = await launchAmman()

  let pidBeforeRestart: number

  t.test('fetch: validator pid', async (t) => {
    const pid = await client.fetchValidatorPid()
    spok(t, { pid }, { $topic: 'validator pid', pid: spok.gtz })
    pidBeforeRestart = pid
  })

  t.test('request to restart validator', async (t) => {
    try {
      await client.requestRestartValidator()
    } catch (err: any) {
      t.fail(err)
    }
  })

  t.test('fetch: validator pid after restart', async (t) => {
    const pid = await client.fetchValidatorPid()
    spok(t, { pid }, { $topic: 'validator pid', pid: spok.gtz })
    t.notEqual(
      pid,
      pidBeforeRestart,
      'a new validator with different pid has started up'
    )
    pidBeforeRestart = pid
  })

  t.test('kill amman', async (t) => {
    await killAmman(t, state)
    t.pass('properly killed amman')
  })
})
