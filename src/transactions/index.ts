import { SendOptions } from '@solana/web3.js'

export * from './types'
export * from './transaction-handler'

export const defaultSendOptions: SendOptions = {
  skipPreflight: false,
  preflightCommitment: 'confirmed',
}
