import {
  ConfirmOptions,
  Connection,
  Keypair,
  Signer,
  Transaction,
} from '@solana/web3.js'
import { defaultConfirmOptions } from '.'
import {
  ConfirmedTransactionAsserts,
  ConfirmedTransactionDetails,
  TransactionHandler,
} from './types'
import { AddressLabels } from '../diagnostics/address-labels'
import type { ErrorResolver } from '@metaplex-foundation/cusper'
import {
  Assert,
  assertContainMessages,
  assertTransactionError,
  assertTransactionSuccess,
} from '../asserts'
import { fetchTransactionSummary } from './transaction-checker'

export type TransactionLabelMapper = (label: string) => string
const FAIL = '❌'
function defaultTransactionLabelMapper(label: string) {
  return label.replace(/^(Fail|Fails|Failure|Err|Error|Bug):?/i, FAIL)
}

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
    skippingPreflight: boolean
  ) {
    super(executor)
    this.errorStack = new Error().stack?.split('\n').slice(2).join('\n')
    this.calledAssert = false
    if (skippingPreflight) {
      setImmediate(() => {
        if (!this.calledAssert) {
          throw new Error(
            `
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
).assertNone()

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
   * Call this if you expect the transaction to raise an error.
   *
   * @param errOrRx either the {@link Error} type expected to be raised or same as {@link msgRx}
   * @param msgRx if provided it is verified that the error string matches this {@link RegExp}
   */
  async assertError<Err extends Function>(
    t: Assert,
    errOrRx: Err | RegExp,
    msgRx?: RegExp
  ) {
    this.calledAssert = true
    try {
      const details = await this
      assertTransactionError(t, details, errOrRx, msgRx)
      return details
    } catch (err: any) {
      // In case the transaction cannot be sent, i.e. if signature verification fails
      // then resolving the transaction fails sync. However we want the user to not
      // have to worry about how it fails and allow them to use the same API to expect
      // errors.
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
   * Call this to explicitly bypass any asserts but still skip preflight.
   * Use this with care as transaction errors may go unnoticed that way.
   * It is useful to capture the transaction result while diagnosing issues.
   */
  async assertNone() {
    this.calledAssert = true
    return this
  }
}

/**
 * A {@link TransactionHandler} backed by a payer {@link Keypair}.
 * @category transactions
 */
export class PayerTransactionHandler implements TransactionHandler {
  /**
   * Creates a {@link PayerTransactionHandler}.
   *
   * @param connection to use to handle transactions
   * @param payer to use to sign transactions
   * @param errorResolver used to resolve a known error from the program logs
   */
  constructor(
    private readonly connection: Connection,
    private readonly payer: Keypair,
    private readonly errorResolver?: ErrorResolver,
    private readonly transactionLabelMapper: TransactionLabelMapper = defaultTransactionLabelMapper
  ) {}

  /**
   * Public key of the payer
   */
  get publicKey() {
    return this.payer.publicKey
  }

  /**
   * Sends and confirms the transaction {@link TransactionHandler['sendAndConfirmTransaction']}.
   */
  sendAndConfirmTransaction(
    transaction: Transaction,
    signers: Array<Signer>,
    optionsOrLabel?: ConfirmOptions | string,
    label?: string
  ): ConfirmedTransactionAssertablePromise {
    const optionsIsLabel = typeof optionsOrLabel === 'string'
    const options = optionsIsLabel ? {} : optionsOrLabel
    const addressLabel = optionsIsLabel ? optionsOrLabel : label

    const confirmOptions = { ...defaultConfirmOptions, ...options }
    return new ConfirmedTransactionAssertablePromise(
      async (resolve, reject) => {
        try {
          transaction.recentBlockhash = (
            await this.connection.getLatestBlockhash()
          ).blockhash

          const txSignature = await this.connection.sendTransaction(
            transaction,
            [this.payer, ...signers],
            confirmOptions
          )
          if (addressLabel != null) {
            AddressLabels.instance.addLabel(
              this.transactionLabelMapper(addressLabel),
              txSignature
            )
          }

          const txRpcResponse = await this.connection.confirmTransaction(
            txSignature,
            confirmOptions.commitment
          )
          const { txSummary, txConfirmed } = await fetchTransactionSummary(
            this.connection,
            txSignature,
            this.errorResolver
          )

          const details: ConfirmedTransactionDetails = {
            txSignature,
            txRpcResponse,
            txConfirmed,
            txSummary,
          }

          resolve(details)
        } catch (err) {
          reject(err)
        }
      },
      confirmOptions.skipPreflight ?? false
    )
  }
}
