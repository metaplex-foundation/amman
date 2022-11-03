import type { ErrorResolver } from '@metaplex-foundation/cusper'
import {
  Connection,
  TransactionResponse,
  TransactionSignature,
} from '@solana/web3.js'
import { strict as assert } from 'assert'
import {
  Assert,
  assertContainMessages,
  AssertOpts,
  assertTransactionError,
  assertTransactionSuccess,
} from '../asserts/asserts'
import { TransactionSummary } from './types'

/**
 * @property summary obtained to execute the assert
 * @property processed transaction obtained to execute the assert
 **/
export class TransactionCheckerAssertReturn {
  readonly txSummary: TransactionSummary
  readonly txConfirmed: TransactionResponse

  constructor(args: {
    txSummary: TransactionSummary
    txConfirmed: TransactionResponse
  }) {
    this.txSummary = args.txSummary
    this.txConfirmed = args.txConfirmed
  }

  get logs() {
    return this.txSummary.logMessages
  }

  get loggedError() {
    return this.txSummary.loggedError
  }

  get transactionMessage() {
    return this.txConfirmed.transaction.message
  }
}
/**
 * If you cannot use a builtin amman {@link TransactionHandler}, i.e. {@link PayerTransactionHandler}
 * then you can use this class to verify the outcome of your transactions.
 * @category transactions
 * @category asserts
 */
export class TransactionChecker {
  constructor(
    readonly connection: Connection,
    readonly errorResolver?: ErrorResolver
  ) {}

  /**
   * Asserts that the transaction to completed successfully.
   *
   * @param msgRxs if provided it is verified that the logs match all these {@link RegExp}es
   * @category transactions
   * @category asserts
   */
  async assertSuccess(
    t: Assert,
    txSignature: TransactionSignature,
    msgRxs?: RegExp[]
  ): Promise<TransactionCheckerAssertReturn> {
    const { txSummary, txConfirmed } = await fetchTransactionSummary(
      this.connection,
      txSignature,
      this.errorResolver
    )
    assertTransactionSuccess(t, { txSummary, txSignature }, msgRxs)
    return new TransactionCheckerAssertReturn({ txSummary, txConfirmed })
  }

  /**
   * Call this if you expect the sending and confirming the transaction to
   * return with a transaction error.
   *
   * @param errOrRx either the {@link Error} type expected to be raised or same as {@link msgRx}
   * @param msgRx if provided it is verified that the error string matches this {@link RegExp}
   * @category transactions
   * @category asserts
   */
  async assertError<Err extends Function>(
    t: Assert,
    txSignature: TransactionSignature,
    errOrRx?: Err | RegExp,
    msgRx?: RegExp
  ) {
    const { txSummary, txConfirmed } = await fetchTransactionSummary(
      this.connection,
      txSignature,
      this.errorResolver
    )
    assertTransactionError(t, { txSummary, txSignature }, errOrRx, msgRx)
    return new TransactionCheckerAssertReturn({ txSummary, txConfirmed })
  }

  /**
   * Call this if to assert that the log messages match a given set of regular expressions.
   * This does not check for success or failure of the transaction.
   *
   * @param msgRxs it is verified that the logs match all these {@link RegExp}es
   * @param opts options to customize the assertion diagnostics
   * @category transactions
   * @category asserts
   */
  async assertLogs(
    t: Assert,
    txSignature: TransactionSignature,
    msgRxs: RegExp[],
    opts: AssertOpts
  ) {
    const { txSummary, txConfirmed } = await fetchTransactionSummary(
      this.connection,
      txSignature,
      this.errorResolver
    )
    assertContainMessages(
      t,
      txSummary.logMessages,
      msgRxs,
      opts,
      'log messages'
    )
    return new TransactionCheckerAssertReturn({ txSummary, txConfirmed })
  }
}

/** @private */
export async function fetchTransactionSummary(
  connection: Connection,
  txSignature: TransactionSignature,
  errorResolver?: ErrorResolver
) {
  const txConfirmed = await connection.getTransaction(txSignature)
  assert(txConfirmed != null, 'confirmed transaction should not be null')
  const txSummary = transactionSummary(txConfirmed, errorResolver)
  return { txSummary, txConfirmed }
}

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
