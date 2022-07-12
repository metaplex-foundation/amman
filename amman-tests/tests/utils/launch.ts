import test, { Test } from 'tape'

import { AmmanConfig } from '@metaplex-foundation/amman'
import { AMMAN_RELAY_URI } from '@metaplex-foundation/amman-client'
import { ConnectedAmmanClient } from '@metaplex-foundation/amman-client/src/amman-client'
import {
  completeConfig,
  DEFAULT_START_CONFIG,
} from '@metaplex-foundation/amman/src/utils/config'
import { initValidator } from '@metaplex-foundation/amman/src/validator/init-validator'
import { AmmanStateInternal } from '@metaplex-foundation/amman/src/validator/types'

const DEFAULT_TEST_CONFIG: Required<AmmanConfig> = { ...DEFAULT_START_CONFIG }

DEFAULT_TEST_CONFIG.storage.enabled = false
DEFAULT_TEST_CONFIG.streamTransactionLogs = false

export async function launchAmman(conf: Partial<AmmanConfig> = {}) {
  const config = completeConfig({ ...DEFAULT_TEST_CONFIG, ...conf })
  return initValidator(config) as Promise<AmmanStateInternal>
}

export async function killAmman(t: Test, ammanState: AmmanStateInternal) {
  if (ammanState.relayServer != null) {
    try {
      await ammanState.relayServer.close()
    } catch (err) {
      t.error(err, 'amman relay failed to close properly')
    }
  }
  process.kill(ammanState.pid)

  killStuckProcess()
}

/**
 * This is a workaround the fact that web3.js doesn't close it's socket connection and provides no way to do so.
 * Therefore the process hangs for a considerable time after the tests finish, increasing the feedback loop.
 *
 * Therefore until https://github.com/solana-labs/solana/issues/25069 is addressed we'll see:
 * ws error: connect ECONNREFUSED 127.0.0.1:8900
 * printed to the console
 *
 * This fixes this by exiting the process as soon as all tests are finished.
 */
export function killStuckProcess() {
  // Don't do this in CI since we need to ensure we get a non-zero exit code if tests fail
  if (process.env.CI == null) {
    test.onFinish(() => process.exit(0))
  }
}

export function relayClient() {
  return ConnectedAmmanClient.getInstance(AMMAN_RELAY_URI, {
    autoUnref: true,
    ack: false,
  })
}
