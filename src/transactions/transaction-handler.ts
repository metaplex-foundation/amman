import { strict as assert } from 'assert'
import {
  ConfirmOptions,
  Connection,
  Keypair,
  Signer,
  Transaction,
  TransactionResponse,
} from '@solana/web3.js'
import { defaultConfirmOptions } from '.'
import {
  ConfirmedTransactionAsserts,
  ConfirmedTransactionDetails,
  TransactionHandler,
  TransactionSummary,
} from './types'
import { AddressLabels } from '../diagnostics/address-labels'
import type { ErrorResolver } from '@metaplex-foundation/cusper'
import {
  Assert,
  assertTransactionError,
  assertTransactionSuccess,
} from '../asserts'

function transactionSummary(
  tx: TransactionResponse,
  errorResolver?: ErrorResolver
): TransactionSummary {
  const logMessages = tx.meta?.logMessages ?? []
  const fee = tx.meta?.fee
  const slot = tx.slot
  const blockTime = tx.blockTime ?? 0
  const transactionError = tx.meta?.err
  const errorLogs = (tx.meta?.err as { logs?: string[] })?.logs ?? []
  const logs = [...errorLogs, ...logMessages]
  // TODO(thlorenz): cusper needs to get smarter and allow passing in the programs we're actually using
  // i.e. if TokenProgram is not in use it should fall thru to the SystemProgram error, i.e. for 0x0
  // it currently resolves TokenLendingProgram error which is misleading.
  // Alternatively it should include the originally parsed message as part of the error somehow so in case
  // the error is incorrectly resolved we have that information.
  const loggedError =
    errorResolver?.errorFromProgramLogs(logs, true) ?? undefined
  return {
    logMessages,
    fee,
    slot,
    blockTime,
    transactionError,
    loggedError,
  }
}

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
    this.calledAssert = false
    if (skippingPreflight) {
      setImmediate(() => {
        if (!this.calledAssert) {
          throw new Error(
            `When skipping preflight you need to call 'assertSuccess' or 'assertError' directly on the Promise
that is returned by the amman TransactionHandler.
Otherwise transaction errors go unhandled. 

NOTE: that when no 'skipPreflight' option is provided then it defaults to 'true'.

Examples:

  await txHandler.sendAndConfirmTransaction(
    tx,
    signers,
  )
  .assertSuccess(t)

  await txHandler.sendAndConfirmTransaction(
    tx,
    signers,
    { skipPreflight: true, commitment: 'confirmed' },
  )
  .assertError(t, StakeDoesNotMatchError)
  .then((res: ConfirmedTransactionDetails) => console.log(res.txSignature))

Alternatively you can ignore this error by calling 'assertNone' on the returned Promise.

Example:

  await txHandler.sendAndConfirmTransaction(
    tx,
    signers,
  )
  .assertNone()
            `
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
    const details = await this
    assertTransactionError(t, details, errOrRx, msgRx)
    return details
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
          const txConfirmed = await this.connection.getTransaction(txSignature)

          assert(
            txConfirmed != null,
            'confirmed transaction should not be null'
          )

          const txSummary = transactionSummary(txConfirmed, this.errorResolver)

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
