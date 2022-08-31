import {
  MSG_REQUEST_SNAPSHOT_SAVE,
  SnapshotSaveResult,
} from '@metaplex-foundation/amman-client'
import path from 'path'
import { promises as fs } from 'fs'
import spok from 'spok'
import test from 'tape'
import { assertHasResult } from '../utils/asserts'

import { killAmman, launchAmman } from '../utils/launch'
import { restClient } from '../utils/rest-client'

// @ts-ignore importing json module
import saved from '../../fixtures/snapshots/01_token-metadata/accounts/13DX32Lou1qH62xUosRyk9QnQpetbuxtEgPzbkKvQmVu.json'
const fixtures = path.resolve(__dirname, '../../fixtures')
const assetsDir = path.join(fixtures, 'assets')

const accAddress = saved.pubkey

test('account-states: given amman is running with relay and one loaded account', async (t) => {
  const client = await restClient()
  let snapshotDir: string | undefined
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

  t.test('post: saving snapshot', async (t) => {
    const snapshotLabel = 'test-snapshot'
    const reply = await client.request<SnapshotSaveResult>(
      MSG_REQUEST_SNAPSHOT_SAVE,
      [snapshotLabel]
    )
    assertHasResult(t, reply)
    spok(t, reply.result, {
      $topic: 'result',
      snapshotDir: spok.endsWith(snapshotLabel),
    })
    const acc = require(path.join(
      reply.result.snapshotDir,
      'accounts',
      'loaded account.json'
    ))
    t.equal(acc.pubkey, accAddress, 'includes loaded account in snapshot')
    snapshotDir = reply.result.snapshotDir
  })

  t.test('kill amman', async (t) => {
    await killAmman(t, state)

    t.pass('properly killed amman')

    if (snapshotDir != null) {
      const snapshotRoot = path.resolve(snapshotDir, '..')
      if (snapshotRoot.endsWith('snapshots')) {
        await fs.rm(snapshotRoot, { recursive: true })
        t.pass('Properly removed snapshot root')
      } else {
        t.fail(`Resolved invalid snapshot root (${snapshotRoot}). Not removing`)
      }
    }
  })
})
