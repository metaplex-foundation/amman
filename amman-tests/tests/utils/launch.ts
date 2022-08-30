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
import { DeepPartial } from '@metaplex-foundation/amman/src/types'
import { logError } from '@metaplex-foundation/amman/dist/utils'

const DEFAULT_TEST_CONFIG: Required<AmmanConfig> = { ...DEFAULT_START_CONFIG }

DEFAULT_TEST_CONFIG.storage.enabled = false
DEFAULT_TEST_CONFIG.streamTransactionLogs = false
// by default in CI the relay is disabled but we need it on since we're testing it
DEFAULT_TEST_CONFIG.relay.enabled = true

function createTimeout(
  ms: number,
  rejectError: Error,
  reject: (reason: any) => void
) {
  return setTimeout(() => reject(rejectError), ms)
}

function resolveWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  task: string
): Promise<T> {
  return new Promise<T>(async (resolve, reject) => {
    const timeout = createTimeout(
      ms,
      new Error(`Unable to ${task}.`),
      (reason: any) => {
        reject(reason)
      }
    )

    try {
      const res = await promise
      clearTimeout(timeout)
      resolve(res)
    } catch (err: any) {
      clearTimeout(timeout)
      reject(err)
    }
  })
}

export async function launchAmman(conf: DeepPartial<AmmanConfig> = {}) {
  const config = completeConfig({ ...DEFAULT_TEST_CONFIG, ...conf })
  try {
    const ammanState = await resolveWithTimeout(
      initValidator(config),
      5e3,
      'connect to test validator via amman'
    )
    return ammanState as AmmanStateInternal
  } catch (err: any) {
    logError(err)
    logError('Ending test due to above isssue')
    process.exit(1)
  }
}

export async function killAmman(t: Test, ammanState: AmmanStateInternal) {
  if (ammanState.relayServer != null) {
    try {
      await resolveWithTimeout(
        ammanState.relayServer.close(),
        2e3,
        'close amman relay server'
      )
    } catch (err) {
      t.error(err, 'amman relay failed to close properly')
    }
  }
  process.kill(ammanState.validator.pid!)

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
