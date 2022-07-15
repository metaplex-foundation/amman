import { Test } from 'tape'
import {
  isReplyWithError,
  isReplyWithResult,
  RelayReply,
} from '@metaplex-foundation/amman-client'

export function assertHasResult<T>(
  t: Test,
  reply: RelayReply<T>
): asserts reply is { result: T } {
  if (isReplyWithResult(reply)) {
    t.pass('reply has result')
  } else if (isReplyWithError(reply)) {
    t.fail(`reply has unexpected error ${reply.err}`)
  } else {
    t.fail(`reply has no result nor an error`)
  }
}

/**
 * In contrast to {@link assertHasResult} this makes sure that there is no error
 * and that the result is undefined as well.
 * This is the case for requests that trigger an action but don't return anything.
 */
export function assertSuccess<T>(
  t: Test,
  reply: RelayReply<T>
): asserts reply is { result: T } {
  if (isReplyWithResult(reply)) {
    t.fail(
      `reply has result that was not expected: \n${JSON.stringify(
        reply.result
      )}`
    )
  } else if (isReplyWithError(reply)) {
    t.fail(`reply has unexpected error ${reply.err}`)
  } else {
    t.pass(`reply indicates success`)
  }
}

export function assertHasError<T>(
  t: Test,
  reply: RelayReply<T>
): asserts reply is { err: string } {
  if (isReplyWithError(reply)) {
    t.pass('reply has error')
  } else if (reply.result != null) {
    t.fail(
      `reply was expected to have an error, but has a result instead: \n${JSON.stringify(
        reply.result
      )}`
    )
  } else {
    t.fail(`reply was expected to have an error, but didn't`)
  }
}
