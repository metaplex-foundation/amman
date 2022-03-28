import { TransactionResponse } from '@solana/web3.js'
import {
  ConfirmedTransactionDetails,
  MaybeErrorWithCode,
  TransactionSummary,
} from '../transactions'

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
 * @param t
 * @param summary transaction summary to verify
 * @param args specify what details should be verified
 * @category asserts
 */
export function assertTransactionSummary(
  t: Assert,
  summary: TransactionSummary,
  args: { fee?: number; msgRx?: RegExp[] } = {}
) {
  t.equal(
    summary.transactionError,
    null,
    'transaction summary has no transaction error'
  )
  if (args.fee != null) {
    t.equal(summary.fee, args.fee, 'transaction summary fee matches')
  }
  if (args.msgRx != null) {
    for (const msgRx of args.msgRx) {
      const hasMatch = summary.logMessages.some((x) => msgRx.test(x))
      if (!hasMatch) {
        console.error('Failed to find %s inside', msgRx.toString())
        console.error(summary.logMessages.join('\n  '))
      }

      t.ok(
        hasMatch,
        `match '${msgRx.toString()}' in transaction summary log messages`
      )
    }
  }
}

/**
 * Asserts details about the provided error.
 *
 * @param t
 * @param err error to verify
 * @param msgRxs list of {@link RegExp} which will be matched on the error _message_ or `err.logs`.
 * @category asserts
 */
export function assertError(
  t: Assert,
  err: Error & { logs?: string[] },
  msgRxs: RegExp[]
) {
  t.ok(err != null, 'error encountered')
  const errorMessages = err
    .toString()
    .split('\n')
    .concat(err.logs ?? [])

  for (const msgRx of msgRxs) {
    const hasMatch = errorMessages.some((x) => msgRx.test(x))
    if (!hasMatch) {
      console.error('Failed to find %s inside', msgRx.toString())
      console.error(errorMessages.join('\n  '))
    }

    t.ok(hasMatch, `match '${msgRx.toString()}' in error message`)
  }
}

/**
 * Asserts that the provided error matches the expected one by verifying the
 * error type and optionally the error message.
 *
 * @param t
 * @param err error to verify
 * @param ty the type of the error to expect
 * @param msgRx a {@link RegExp} that the error message is expected to match
 */
export function assertMatchesError<Err extends Function>(
  t: Assert,
  err: MaybeErrorWithCode,
  ty: Err,
  msgRx?: RegExp
) {
  if (err == null) {
    t.fail(`Expected an error of type ${ty}`)
    return
  }
  t.ok(err instanceof ty, ty.name)
  if (msgRx != null) {
    t.match(err.message, msgRx)
  }
}

/**
 * Asserts that the provided {@link ConfirmedTransactionDetails} has an error
 * that matches the expected one by verifying the error type and optionally the
 * error message.
 *
 * @param t
 * @param res result of executing a transaction
 * @param ty the type of the error to expect
 * @param msgRx a {@link RegExp} that the error message is expected to match
 */
export function assertHasError<Err extends Function>(
  t: Assert,
  res: ConfirmedTransactionDetails,
  ty: Err,
  msgRx?: RegExp
) {
  return assertMatchesError(t, res.txSummary.err, ty, msgRx)
}
