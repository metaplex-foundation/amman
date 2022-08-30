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

export type AccountStatesResult = {
  pubkey: string
  states: RelayAccountState[]
}

export type AccountSaveResult = {
  pubkey: string
  accountPath: string
}

export type SnapshotSaveResult = {
  snapshotDir: string
}

export type AddressLabelsResult = {
  labels: Record<string, string>
}

export type LoadKeypairResult = {
  id: string
  keypair?: Uint8Array
}

export type ValidatorPidResult = number

export type AmmanVersion = [number, number, number]

export type VoidResult = {
  void: void
}
export const VOID_REPLY: RelayReply<VoidResult> = { result: { void: void 0 } }
