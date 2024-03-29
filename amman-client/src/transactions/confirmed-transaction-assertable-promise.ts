import {
  Assert,
  assertContainMessages,
  assertTransactionError,
  assertTransactionSuccess,
} from '../asserts/asserts'
import {
  ConfirmedTransactionAsserts,
  ConfirmedTransactionDetails,
} from './types'

const MISSING_ASSERT_MESSAGE = `
## Problem

When skipping preflight you need to call 'assertSuccess' or 'assertError' 
directly on the Promise that is returned by the amman TransactionHandler.

Otherwise transaction errors go unhandled. 

NOTE: that when no 'skipPreflight' option is provided then it defaults to 'true'.

## Examples:

  await txHandler.sendAndConfirmTransaction(
    tx,
    signers,
  ).assertSuccess(t)

  await txHandler.sendAndConfirmTransaction(
    tx,
    signers,
    { skipPreflight: true, commitment: 'confirmed' },
  )
  .assertError(t, StakeDoesNotMatchError)
  .then((res: ConfirmedTransactionDetails) => console.log(res.txSignature))

## Workaround

Alternatively you can ignore this error by calling 'assertNone' on the returned Promise.

await txHandler.sendAndConfirmTransaction(
  tx,
  signers,
).assertNone()`

type ConfirmedTransactionAssertablePromiseOpts = {
  requireAssert: boolean
  transactionLabel?: string
}

/**
 * A {@link Promise} that is returned by {@link PayerTransactionHandler} `sendAndConfirmTransaction`.
 * Aside from regular promise functionality it includes `assert` methods that
 * need to be called as part of `sendAndConfirmTransaction`.
 * This way it is ensured that unexpected behavior does not go unnoticed.
 */
export class ConfirmedTransactionAssertablePromise
  extends Promise<ConfirmedTransactionDetails>
  implements ConfirmedTransactionAsserts
{
  private calledAssert: boolean
  private transactionLabel?: string
  private errorStack?: string
  constructor(
    executor: (
      resolve: (
        value:
          | ConfirmedTransactionDetails
          | PromiseLike<ConfirmedTransactionDetails>
      ) => void,
      reject: (reason?: any) => void
    ) => void,
    // It seems that this constructor is invoked from outside our code, possibly due to being a promise.
    // In that case this second param is not passed, so we need to account for that.
    opts?: ConfirmedTransactionAssertablePromiseOpts
  ) {
    super(executor)
    this.errorStack = new Error().stack?.split('\n').slice(2).join('\n')
    this.transactionLabel = opts?.transactionLabel
    this.calledAssert = false
    if (opts?.requireAssert ?? false) {
      setImmediate(() => {
        if (!this.calledAssert) {
          throw new Error(
            `
${MISSING_ASSERT_MESSAGE}
## Origin

${this.errorStack}`
          )
        }
      })
    }
  }

  /**
   * Call this if you expect the transaction to complete successfully.
   *
   * @param msgRxs if provided it is verified that the logs match all these {@link RegExp}es
   * @category transactions
   * @category asserts
   */
  async assertSuccess(t: Assert, msgRxs?: RegExp[]) {
    this.calledAssert = true
    const details = await this
    assertTransactionSuccess(
      t,
      { ...details, txLabel: this.transactionLabel },
      msgRxs
    )
    return details
  }

  /**
   * Call this if you expect the sending and confirming the transaction to
   * return with a transaction error.
   *
   * @param errOrRx either the {@link Error} type expected or same as {@link msgRx}
   * @param msgRx if provided it is verified that the error string matches this {@link RegExp}
   * @category transactions
   * @category asserts
   */
  async assertError<Err extends Function>(
    t: Assert,
    errOrRx?: Err | RegExp,
    msgRx?: RegExp
  ) {
    this.calledAssert = true
    const details = await this
    assertTransactionError(
      t,
      { ...details, txLabel: this.transactionLabel },
      errOrRx,
      msgRx
    )
    return details
  }

  /**
   * Call this if you expect sending/confirming the transaction throws an error.
   * One example for this is failing signature verification.
   *
   * @param errOrRx either the {@link Error} type expected to be thrown or same as {@link msgRx}
   * @param msgRx if provided it is verified that the error string matches this {@link RegExp}
   * @category transactions
   * @category asserts
   */
  async assertThrows<Err extends Function>(
    t: Assert,
    errOrRx?: Err | RegExp,
    msgRx?: RegExp
  ) {
    this.calledAssert = true
    try {
      const details = await this
      const label = this.transactionLabel ?? details.txSignature
      t.fail(
        `Transaction '${label}' was expected to throw an error when sending/confirming the transaction but it succeeded.`
      )
      return details
    } catch (err: any) {
      const error = typeof errOrRx === 'function' ? errOrRx : undefined
      const rx = typeof errOrRx === 'function' ? msgRx : errOrRx
      const label = this.transactionLabel ?? 'N/A'
      if (error != null) {
        t.ok(
          err instanceof error,
          `Error found inside transaction '${label}' is of type ${error.name}`
        )
      }
      if (rx != null) {
        assertContainMessages(
          t,
          err.toString().split('\n'),
          [rx],
          { txLabel: this.transactionLabel },
          'error message'
        )
      }
    }
  }

  /**
   * Call this if to assert that the log messages match a given set of regular expressions.
   * This does not check for success or failure of the transaction.
   *
   * @param msgRxs it is verified that the logs match all these {@link RegExp}es
   * @category transactions
   * @category asserts
   */
  async assertLogs(t: Assert, msgRxs: RegExp[]) {
    this.calledAssert = true
    const details = await this
    assertContainMessages(
      t,
      details.txSummary.logMessages,
      msgRxs,
      { txLabel: this.transactionLabel, txSignature: details.txSignature },
      'log messages'
    )
  }

  /**
   * Call this to explicitly bypass any asserts but still skip preflight.
   * Use this with care as transaction errors may go unnoticed that way.
   * It is useful to capture the transaction result while diagnosing issues.
   * @category transactions
   * @category asserts
   */
  async assertNone() {
    this.calledAssert = true
    return this
  }
}
