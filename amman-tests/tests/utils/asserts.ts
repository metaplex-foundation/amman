import { Test } from 'tape'
import {
  isReplyWithError,
  isReplyWithResult,
  RelayReply,
} from '@metaplex-foundation/amman/src/relay/handler'

export function assertHasResult<T>(
  t: Test,
  reply: RelayReply<T>
): asserts reply is { result: T } {
  if (isReplyWithResult(reply)) {
    t.pass('reply has result')
  } else {
    t.fail(`reply has unexpected error ${reply.err}`)
  }
}

export function assertHasError<T>(
  t: Test,
  reply: RelayReply<T>
): asserts reply is { err: string } {
  if (isReplyWithError(reply)) {
    t.pass('reply has error')
  } else {
    t.fail(`reply was expected to have an error, but didn't`)
  }
}
