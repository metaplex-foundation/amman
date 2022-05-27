import { ConfirmOptions } from '@solana/web3.js'

/**
 * Default options for sending and confirming a transaction
 * @category transactions
 */
export const defaultConfirmOptions: ConfirmOptions = {
  skipPreflight: true,
  preflightCommitment: 'confirmed',
  commitment: 'confirmed',
}
