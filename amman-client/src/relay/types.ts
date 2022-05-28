import type { Diff } from 'deep-diff'
import type { Change } from 'diff'

export type AccountDiff = Array<Diff<Record<string, any>, Record<string, any>>>
export type RelayAccountState = {
  account: Record<string, any>
  accountDiff?: AccountDiff
  slot: number
  rendered?: string
  renderedDiff?: Change[]
  timestamp: number
}
