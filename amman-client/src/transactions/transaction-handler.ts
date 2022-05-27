import type { ErrorResolver } from '@metaplex-foundation/cusper'
import {
  ConfirmOptions,
  Connection,
  Keypair,
  Signer,
  Transaction,
} from '@solana/web3.js'
import { AddressLabels } from '../diagnostics/address-labels'
import { ConfirmedTransactionAssertablePromise } from './confirmed-transaction-assertable-promise'
import { defaultConfirmOptions } from './consts'
import { fetchTransactionSummary } from './transaction-checker'
import { ConfirmedTransactionDetails, TransactionHandler } from './types'

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

          const details = new ConfirmedTransactionDetails({
            txSignature,
            txRpcResponse,
            txConfirmed,
            txSummary,
          })

          resolve(details)
        } catch (err) {
          reject(err)
        }
      },
      confirmOptions.skipPreflight ?? false
    )
  }
}
