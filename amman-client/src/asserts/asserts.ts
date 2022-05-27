import { TransactionResponse, TransactionSignature } from '@solana/web3.js'
import { AMMAN_EXPLORER } from '../consts'
import type {
  ConfirmedTransactionDetails,
  MaybeErrorWithCode,
  TransactionSummary,
} from '../transactions/types'
import { logError, logInfo } from '../utils/log'

/**
 * The minimum methods that the first argument passed to assert functions like
 * {@link assertConfirmedTransaction} needs to have.
 *
 * @category asserts
 */
export type Assert = {
  equal(actual: any, expected: any, msg?: string): void
  ok(value: any, msg?: string): void
  fail(msg?: string): void
  match(actual: string, expected: RegExp, msg?: string): void
}

/**
 * Asserts details about a confirmed transaction
 *
 * @deprecated use {@link assertTransactionSuccess} or {@link assertTransactionError} instead
 *
 * @param t
 * @param tx the confirmed transaction to verify
 * @param args specify what details should be verified
 * @category asserts
 */
export function assertConfirmedTransaction(
  t: Assert,
  tx: TransactionResponse,
  args: { fee?: number } = {}
) {
  t.equal(tx.meta?.err, null, 'confirmed transaction has no error')

  if (args.fee != null) {
    t.equal(tx.meta?.fee, args.fee, 'confirmed transaction fee matches')
  }
}

/**
 * Asserts details about a {@link TransactionSummary}.
 *
 * @deprecated use {@link assertTransactionSuccess} or {@link assertTransactionError} instead
 *
 * @param t
 * @param summary transaction summary to verify
 * @param args specify what details should be verified
 * @category asserts
 */
export function assertTransactionSummary(
  t: Assert,
  summary: TransactionSummary,
  args: { fee?: number; msgRxs?: RegExp[]; failed?: boolean } = {}
) {
  const { failed = false } = args
  if (failed) {
    t.ok(summary.transactionError, 'transaction summary has transaction error')
  } else {
    t.ok(
      summary.transactionError == null,
      'transaction summary has no transaction error'
    )
    if (summary.loggedError != null) {
      t.fail(summary.loggedError.stack ?? summary.loggedError.toString())
    }
  }
  if (args.fee != null) {
    t.equal(summary.fee, args.fee, 'transaction summary fee matches')
  }
  if (args.msgRxs != null) {
    assertContainMessages(t, summary.logMessages, args.msgRxs)
  }
}

/**
 * Asserts that a transaction completed successfully and optionally checks for
 * messages in the transaction logs.
 *
 */
export function assertTransactionSuccess(
  t: Assert,
  details: Pick<ConfirmedTransactionDetails, 'txSummary'> & {
    txSignature?: TransactionSignature
  },
  msgRxs?: RegExp[]
) {
  const summary = details.txSummary
  if (summary.loggedError != null) {
    t.fail(summary.loggedError.stack ?? summary.loggedError.toString())
    logError({ logs: summary.logMessages })
    if (details.txSignature != null) {
      logInfo(`Inspect via: ${AMMAN_EXPLORER}#/tx/${details.txSignature}`)
    }
    return
  }
  t.ok(
    summary.transactionError == null,
    'transaction summary has no transaction error'
  )
  if (msgRxs != null) {
    assertContainMessages(t, summary.logMessages, msgRxs)
  }
}

/**
 * Asserts that the provided {@link ConfirmedTransactionDetails} has an error
 * that matches the provided requirements.
 *
 * Provide either an `Error` to {@link errOrRx} to verify the error type or a
 * {@link RegExp} to only verify the error message.
 * In order to verify both provide an `Error` to {@link errOrRx} and the {@link
 * RegExp} via {@link msgRx}.
 *
 * @param t
 * @param details result of executing a transaction
 * @param errOrRx the type of the error to expect or the {@link msgRx} to match
 * @param msgRx a {@link RegExp} that the error message is expected to match
 */
export function assertTransactionError<Err extends Function>(
  t: Assert,
  details: Pick<ConfirmedTransactionDetails, 'txSummary'> & {
    txSignature?: TransactionSignature
  },
  errOrRx?: Err | RegExp,
  msgRx?: RegExp
) {
  const err = typeof errOrRx === 'function' ? errOrRx : undefined
  const rx = typeof errOrRx === 'function' ? msgRx : errOrRx
  // Support checking for merly the existence of a transaction error
  if (err == null && msgRx == null) {
    t.ok(details.txSummary.transactionError != null, 'transaction failed')
  } else {
    assertErrorMatches(t, details.txSummary.loggedError, {
      type: err,
      msgRx: rx,
      txSignature: details.txSignature,
    })
  }
}

/**
 * Asserts that the provided error contains specific information as part of the
 * error message or the attached error logs.
 *
 * To check for they error type instead use {@link assertErrorMatches} instead.
 *
 * @param t
 * @param err error to verify
 * @param msgRxs list of {@link RegExp} which will be matched on the error _message_ or `err.logs`.
 * @category asserts
 */
export function assertError(t: Assert, err: Error, msgRxs: RegExp[]) {
  t.ok(err != null, 'error encountered')
  const errWithLogs = err as Error & { logs?: string[] }
  t.ok(errWithLogs.logs != null, 'error has logs')
  const errorMessages = err
    .toString()
    .split('\n')
    .concat(errWithLogs.logs ?? [])
  assertContainMessages(t, errorMessages, msgRxs)
}

/**
 * Asserts that the provided logs contain specific messages.
 *
 * @param t
 * @param logs containing messages to match
 * @param msgRxs list of {@link RegExp} which will be matched on the {@link logs}.
 * @category asserts
 * @private
 */
export function assertContainMessages(
  t: Assert,
  logs: string[],
  msgRxs: RegExp[],
  label: string = 'log messages'
) {
  for (const msgRx of msgRxs) {
    const hasMatch = logs.some((x) => msgRx.test(x))
    if (!hasMatch) {
      console.error('Failed to find %s inside', msgRx.toString())
      console.error(logs.join('\n  '))
    }

    t.ok(hasMatch, `match '${msgRx.toString()}' in ${label}`)
  }
}

/**
 * Asserts that the provided error is defined and matches the provided
 * requirements.
 *
 * If {@link opts.type} is provided the error needs to be of that type.
 * If {@link opts.msgRx} is provided the error message needs match to it.
 *
 * @param t
 * @param err error to verify
 * @param opts
 * @param opts.type the type of the error to expect
 * @param opts.msgRx a {@link RegExp} that the error message is expected to match
 */
export function assertErrorMatches<Err extends Function>(
  t: Assert,
  err: MaybeErrorWithCode,
  opts: { type?: Err; msgRx?: RegExp; txSignature?: string } = {}
) {
  if (err == null) {
    t.fail(`Expected an error`)
    if (opts.txSignature != null) {
      logInfo(`Inspect via: ${AMMAN_EXPLORER}#/tx/${opts.txSignature}`)
    }
    return
  }
  if (opts.type != null) {
    t.ok(err instanceof opts.type, `error is of type ${opts.type.name}`)
  }
  if (opts.msgRx != null) {
    t.match(
      err.message,
      opts.msgRx,
      `error message matches ${opts.msgRx.toString()}`
    )
  }
}
