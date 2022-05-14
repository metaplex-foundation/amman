import type { MaybeErrorWithCode } from '@metaplex-foundation/cusper'
export type { MaybeErrorWithCode } from '@metaplex-foundation/cusper'
import {
  Connection,
  PublicKey,
  RpcResponseAndContext,
  SendOptions,
  SignatureResult,
  Signer,
  Transaction,
  TransactionError,
  TransactionResponse,
  TransactionSignature,
} from '@solana/web3.js'
import { Assert } from '../asserts'

/** @private */
export type ErrorFromProgramLogs = (logs: string[]) => MaybeErrorWithCode

/** @private */
export type SendTransaction = (
  connection: Connection,
  transaction: Transaction,
  signers: Array<Signer>,
  options?: SendOptions
) => Promise<TransactionSignature>

/**
 * Derived from a {@link ConfirmedTransaction} this summary eases assertions and logging.
 *
 * @property logMessages obtained from the {@link ConfirmedTransaction['meta']} property
 * @property fee charged for the transaction execution
 * @property slot same as {@link ConfirmedTransaction['slot']
 * @property transactionError obtained from the {@link ConfirmedTransaction['meta']} property
 * @category transactions
 */
export type TransactionSummary = {
  logMessages: string[]
  fee: number | undefined
  slot: number
  blockTime: number
  transactionError: TransactionError | null | undefined
  loggedError: MaybeErrorWithCode
}

export type ConfirmedTransactionAsserts = {
  assertError<Err extends Function>(
    t: Assert,
    errOrRx: Err | RegExp,
    msgRx?: RegExp
  ): void
  assertSuccess(t: Assert, msgRxs?: RegExp[]): void
}

/**
 * Result returned by {@link TransactionHandler#sendAndConfirmTransaction}.
 *
 * @property txSignature {@link TransactionSignature} string of sent transaction
 * @property txRpcResponse initial response of sent transaction
 * @property txConfirmed the result of confirming the transaction
 * @property txSummary a summary of the confirmed transaction
 *
 * @category transactions
 */
export type ConfirmedTransactionDetails = {
  txSignature: string
  txRpcResponse: RpcResponseAndContext<SignatureResult>
  txConfirmed: TransactionResponse
  txSummary: TransactionSummary
}

/**
 * Interface to transaction handlers that can either be backed directly by a
 * payer or can use a wallet.
 *
 * @property publicKey of payer
 * @property sendAndConfirmTransaction sends and confirms a transaction
 *
 * @category transactions
 */
export type TransactionHandler = {
  publicKey: PublicKey

  /**
   * Sends and confirms the given transaction after signing it.
   *
   * @param transaction to send
   * @param signers with which the transaction should be signed
   * @param optionsOrLabel either options used to send the transaction or the {@link label}
   * @param label of the transaction in order to identify it in logs and the amman-explorer
   */
  sendAndConfirmTransaction(
    transaction: Transaction,
    signers: Array<Signer>,
    optionsOrLabel?: SendOptions | string,
    label?: string
  ): Promise<ConfirmedTransactionDetails>
}
