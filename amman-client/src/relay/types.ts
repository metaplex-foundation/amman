import { Diff } from 'deep-diff'

// TODO(thlorenz): Used to be Diff.Change
type DiffChange = any

export type AccountDiff = Array<Diff<Record<string, any>, Record<string, any>>>
export type RelayAccountState = {
  account: Record<string, any>
  accountDiff?: AccountDiff
  slot: number
  rendered?: string
  renderedDiff?: DiffChange[]
  timestamp: number
}
