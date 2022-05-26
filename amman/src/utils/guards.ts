import { Commitment } from '@solana/web3.js'
import { strict as assert } from 'assert'

export const commitments: Readonly<Commitment[]> = [
  'processed',
  'confirmed',
  'finalized',
  'recent',
  'single',
  'singleGossip',
  'root',
  'max',
] as const

export function isCommitment(value: string): value is Commitment {
  return commitments.includes(value as Commitment)
}

export function assertCommitment(value: string): asserts value is Commitment {
  assert(isCommitment(value), `Invalid commitment: ${value}`)
}
