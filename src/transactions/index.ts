import { ConfirmOptions } from '@solana/web3.js'

export * from './types'

/**
 * Default options for sending and confirming a transaction
 * @category transactions
 */
export const defaultConfirmOptions: ConfirmOptions = {
  skipPreflight: true,
  preflightCommitment: 'confirmed',
  commitment: 'confirmed',
}
