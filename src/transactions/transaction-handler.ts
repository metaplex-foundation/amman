import { strict as assert } from 'assert'
import {
  ConfirmedTransaction,
  Connection,
  Keypair,
  SendOptions,
  Signer,
  Transaction,
} from '@solana/web3.js'
import { defaultSendOptions } from '.'
import {
  ConfirmedTransactionDetails,
  TransactionHandler,
  TransactionSummary,
} from './types'

function transactionSummary(tx: ConfirmedTransaction): TransactionSummary {
  const logMessages = tx.meta?.logMessages ?? []
  const fee = tx.meta?.fee
  const slot = tx.slot
  const blockTime = tx.blockTime ?? 0
  const err = tx.meta?.err
  return { logMessages, fee, slot, blockTime, err }
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
   */
  constructor(
    private readonly connection: Connection,
    private readonly payer: Keypair
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
  async sendAndConfirmTransaction(
    transaction: Transaction,
    signers: Array<Signer>,
    options?: SendOptions
  ): Promise<ConfirmedTransactionDetails> {
    transaction.recentBlockhash = (
      await this.connection.getRecentBlockhash()
    ).blockhash

    const txSignature = await this.connection.sendTransaction(
      transaction,
      [this.payer, ...signers],
      options ?? defaultSendOptions
    )
    const txRpcResponse = await this.connection.confirmTransaction(txSignature)
    const txConfirmed = await this.connection.getConfirmedTransaction(
      txSignature
    )

    assert(txConfirmed != null, 'confirmed transaction should not be null')

    const txSummary = transactionSummary(txConfirmed)
    return { txSignature, txRpcResponse, txConfirmed, txSummary }
  }
}
