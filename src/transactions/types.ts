import {
  ConfirmedTransaction,
  Connection,
  PublicKey,
  RpcResponseAndContext,
  SendOptions,
  SignatureResult,
  Signer,
  Transaction,
  TransactionError,
  TransactionSignature,
} from '@solana/web3.js'

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
 * @property err obtained from the {@link ConfirmedTransaction['meta']} property
 */
export type TransactionSummary = {
  logMessages: string[]
  fee: number | undefined
  slot: number
  blockTime: number
  err: TransactionError | null | undefined
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
  txConfirmed: ConfirmedTransaction
  txSummary: TransactionSummary
}

/*
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
   * @param options used to send the transaction
   */
  sendAndConfirmTransaction(
    transaction: Transaction,
    signers: Array<Signer>,
    options?: SendOptions
  ): Promise<ConfirmedTransactionDetails>
}
