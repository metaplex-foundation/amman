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

export type TransactionSummary = {
  logMessages: string[]
  fee: number | undefined
  slot: number
  blockTime: number
  err: TransactionError | null | undefined
}

export type ConfirmedTransactionDetails = {
  txSignature: string
  txRpcResponse: RpcResponseAndContext<SignatureResult>
  txConfirmed: ConfirmedTransaction
  txSummary: TransactionSummary
}

/*
 * Using an interface here in order to support wallet based transaction handler
 * in the future and allow devs to implement their own as well
 */
export type TransactionHandler = {
  publicKey: PublicKey

  sendAndConfirmTransaction(
    transaction: Transaction,
    signers: Array<Signer>,
    options?: SendOptions
  ): Promise<ConfirmedTransactionDetails>
}
