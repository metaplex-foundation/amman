import { SendOptions } from '@solana/web3.js'

export * from './types'
export * from './transaction-handler'

/**
 * Default options for sending a transaction
 * @category transactions
 */
export const defaultSendOptions: SendOptions = {
  skipPreflight: false,
  preflightCommitment: 'confirmed',
}
