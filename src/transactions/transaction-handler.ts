import { strict as assert } from 'assert'
import {
  Connection,
  Keypair,
  SendOptions,
  Signer,
  Transaction,
  TransactionResponse,
} from '@solana/web3.js'
import { defaultSendOptions } from '.'
import {
  ConfirmedTransactionDetails,
  TransactionHandler,
  TransactionSummary,
} from './types'
import { AddressLabels } from '../diagnostics/address-labels'
import type { ErrorResolver } from '@metaplex-foundation/cusper'

function transactionSummary(
  tx: TransactionResponse,
  errorResolver?: ErrorResolver
): TransactionSummary {
  const logMessages = tx.meta?.logMessages ?? []
  const fee = tx.meta?.fee
  const slot = tx.slot
  const blockTime = tx.blockTime ?? 0
  const transactionError = tx.meta?.err
  const err =
    errorResolver?.errorFromProgramLogs(logMessages, true) ?? undefined
  return { logMessages, fee, slot, blockTime, transactionError, err }
}

export type TransactionLabelMapper = (label: string) => string
const FAIL = '❌'
function defaultTransactionLabelMapper(label: string) {
  return label.replace(/^(Fail|Fails|Failure|Err|Error|Bug):?/i, FAIL)
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
  async sendAndConfirmTransaction(
    transaction: Transaction,
    signers: Array<Signer>,
    optionsOrLabel?: SendOptions | string,
    label?: string
  ): Promise<ConfirmedTransactionDetails> {
    transaction.recentBlockhash = (
      await this.connection.getLatestBlockhash()
    ).blockhash

    const optionsIsLabel = typeof optionsOrLabel === 'string'
    const options = optionsIsLabel ? undefined : optionsOrLabel
    const addressLabel = optionsIsLabel ? optionsOrLabel : label
    const txSignature = await this.connection.sendTransaction(
      transaction,
      [this.payer, ...signers],
      options ?? defaultSendOptions
    )
    if (addressLabel != null) {
      AddressLabels.instance.addLabel(
        this.transactionLabelMapper(addressLabel),
        txSignature
      )
    }

    const txRpcResponse = await this.connection.confirmTransaction(txSignature)
    const txConfirmed = await this.connection.getTransaction(txSignature)

    assert(txConfirmed != null, 'confirmed transaction should not be null')

    const txSummary = transactionSummary(txConfirmed, this.errorResolver)
    return { txSignature, txRpcResponse, txConfirmed, txSummary }
  }
}
