import type { Diff } from 'deep-diff'
import type { Change } from 'diff'

export type RelayReply<T> = { result: T } | { err: string }

export function isReplyWithResult<T>(
  reply: RelayReply<T>
): reply is { result: T } {
  return !isReplyWithError(reply) && (reply as { result: T }).result != null
}

export function isReplyWithError<T>(
  reply: RelayReply<T>
): reply is { err: string } {
  return (reply as { err: string }).err != null
}

export type AccountDiff = Array<Diff<Record<string, any>, Record<string, any>>>
export type RelayAccountState = {
  account: Record<string, any>
  accountDiff?: AccountDiff
  slot: number
  rendered?: string
  renderedDiff?: Change[]
  timestamp: number
}
