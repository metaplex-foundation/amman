import { SendOptions } from '@solana/web3.js'

export * from './types'

/**
 * Default options for sending a transaction
 * @category transactions
 */
export const defaultSendOptions: SendOptions = {
  skipPreflight: false,
  preflightCommitment: 'confirmed',
}
