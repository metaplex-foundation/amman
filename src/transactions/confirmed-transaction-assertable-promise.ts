import {
  ConfirmedTransactionAsserts,
  ConfirmedTransactionDetails,
} from './types'
import {
  Assert,
  assertContainMessages,
  assertTransactionError,
  assertTransactionSuccess,
} from '../asserts'

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

export class ConfirmedTransactionAssertablePromise
  extends Promise<ConfirmedTransactionDetails>
  implements ConfirmedTransactionAsserts
{
  private calledAssert: boolean
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
    requireAssert: boolean
  ) {
    super(executor)
    this.errorStack = new Error().stack?.split('\n').slice(2).join('\n')
    this.calledAssert = false
    if (requireAssert) {
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
   */
  async assertSuccess(t: Assert, msgRxs?: RegExp[]) {
    this.calledAssert = true
    const details = await this
    assertTransactionSuccess(t, details, msgRxs)
    return details
  }

  /**
   * Call this if you expect the the result of sending and confirming the transaction
   * to return with a transaction error.
   *
   * @param errOrRx either the {@link Error} type expected or same as {@link msgRx}
   * @param msgRx if provided it is verified that the error string matches this {@link RegExp}
   */
  async assertError<Err extends Function>(
    t: Assert,
    errOrRx?: Err | RegExp,
    msgRx?: RegExp
  ) {
    this.calledAssert = true
    const details = await this
    assertTransactionError(t, details, errOrRx, msgRx)
    return details
  }

  /**
   * Call this if you expect sending/confirming the transaction throws an error.
   * One example for this is failing signature verification.
   *
   * @param errOrRx either the {@link Error} type expected to be thrown or same as {@link msgRx}
   * @param msgRx if provided it is verified that the error string matches this {@link RegExp}
   */
  async assertThrows<Err extends Function>(
    t: Assert,
    errOrRx?: Err | RegExp,
    msgRx?: RegExp
  ) {
    this.calledAssert = true
    try {
      const details = await this
      t.fail(
        'expected to throw an error when sending/confirming the transaction'
      )
      return details
    } catch (err: any) {
      const error = typeof errOrRx === 'function' ? errOrRx : undefined
      const rx = typeof errOrRx === 'function' ? msgRx : errOrRx
      if (error != null) {
        t.ok(err instanceof error, `error is of type ${error.name}`)
      }
      if (rx != null) {
        assertContainMessages(
          t,
          err.toString().split('\n'),
          [rx],
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
   */
  async assertLogs(t: Assert, msgRxs: RegExp[]) {
    this.calledAssert = true
    const details = await this
    assertContainMessages(
      t,
      details.txSummary.logMessages,
      msgRxs,
      'log messages'
    )
  }

  /**
   * Call this to explicitly bypass any asserts but still skip preflight.
   * Use this with care as transaction errors may go unnoticed that way.
   * It is useful to capture the transaction result while diagnosing issues.
   */
  async assertNone() {
    this.calledAssert = true
    return this
  }
}
