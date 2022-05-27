import type { Diff } from 'deep-diff'

export type AccountDiff = Array<Diff<Record<string, any>, Record<string, any>>>
export type RelayAccountState = {
  account: Record<string, any>
  accountDiff?: AccountDiff
  slot: number
  rendered?: string
  renderedDiff?: Diff.Change[]
  timestamp: number
}
