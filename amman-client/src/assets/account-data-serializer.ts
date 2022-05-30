import { strict as assert } from 'assert'

export type SerializeAccountData<T> = (data: T) => [Buffer, number] | Buffer
export type DeserializeAccountData<T> = (
  buf: Buffer,
  offset?: number
) => [T, number] | T

export type PlainAccountDataSerializer<T> = {
  serialize: SerializeAccountData<T>
  deserialize: DeserializeAccountData<T>
}
export type FromArgsAccountDataSerializer<T> = {
  fromArgs(args: T): { serialize: SerializeAccountData<T> }
  deserialize: DeserializeAccountData<T>
}

function isPlainAccountDataSerializer<T>(
  serializer: PlainAccountDataSerializer<T> | FromArgsAccountDataSerializer<T>
): serializer is PlainAccountDataSerializer<T> {
  return (
    typeof (serializer as PlainAccountDataSerializer<T>).serialize ===
    'function'
  )
}

function isFromArgsAccountDataSerializer<T>(
  serializer: PlainAccountDataSerializer<T> | FromArgsAccountDataSerializer<T>
): serializer is FromArgsAccountDataSerializer<T> {
  return (
    typeof (serializer as FromArgsAccountDataSerializer<T>).fromArgs ===
    'function'
  )
}

export type AccountDataSerializer<T> =
  | PlainAccountDataSerializer<T>
  | FromArgsAccountDataSerializer<T>

export function serializeData<T>(
  serializer: AccountDataSerializer<T>,
  data: T
) {
  if (isPlainAccountDataSerializer(serializer)) {
    return serializer.serialize(data)
  } else if (isFromArgsAccountDataSerializer(serializer)) {
    return serializer.fromArgs(data).serialize(data)
  }
  assert.fail('Serializer needs to have serialize or fromArgs method')
}
