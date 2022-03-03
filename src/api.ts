import { AddressLabels, GenKeypair } from './diagnostics/address-labels'
import {
  AmmanClient,
  ConnectedAmmanClient,
  DisconnectedAmmanClient,
} from './relay'

/**
 * Creates an Amman instance which is used to interact with address labels and
 * other amman features.
 * By default it connects the socket client to the running amman validator.
 * This allows it to update the amman-explorer with recent transactions and addresses.
 *
 * NOTE: that Amman should only be instantiated once during the life time of
 * your program, tests, etc.
 *
 * ## Example
 *
 * ```js
 * export const amman = Amman.instance({
 *   knownLabels: { [PROGRAM_ADDRESS]: 'My Program' },
 *   logLabel: console.log,
 * })
 * ```
 */
export class Amman {
  private constructor(readonly addresses: AddressLabels) {}
  private static _instance: Amman | undefined

  /**
   * Generates a keypair and returns its public key and the keypair itself as a Tuple.
   *
   * @param label if provided the key will be added to existing labels
   * @return [publicKey, keypair ]
   */
  genKeypair: GenKeypair = (label?: string) => {
    return this.addresses.genKeypair(label)
  }

  static instance(
    args: {
      knownLabels?: Record<string, string>
      logLabel?: (msg: string) => void
      ammanClient?: AmmanClient
      connectClient?: boolean
    } = {}
  ) {
    const { connectClient = true } = args
    const {
      knownLabels = {},
      logLabel = (_) => {},
      ammanClient = connectClient
        ? ConnectedAmmanClient.getInstance()
        : new DisconnectedAmmanClient(),
    } = args
    if (Amman._instance != null) {
      console.error('Can only create Amman instance once')
      return Amman._instance
    }
    const addAddressLabels = AddressLabels.setInstance(
      knownLabels ?? {},
      logLabel,
      ammanClient
    )
    Amman._instance = new Amman(addAddressLabels)
    return Amman._instance
  }
}
