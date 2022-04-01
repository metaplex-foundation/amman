import type { ErrorResolver } from '@metaplex-foundation/cusper'
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js'
import { AddressLabels, GenKeypair } from './diagnostics/address-labels'
import {
  AmmanClient,
  AmmanClientOpts,
  AMMAN_RELAY_URI,
  ConnectedAmmanClient,
  DisconnectedAmmanClient,
} from './relay'
import {
  AmmanMockStorageDriver,
  AmmanMockStorageDriverOptions,
} from './storage'
import {
  PayerTransactionHandler,
  TransactionLabelMapper,
} from './transactions/transaction-handler'
import { logDebug } from './utils/log'

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
 *
 */
export class Amman {
  private constructor(
    /**
     * Exposes the {@link AddressLabels} API to add and query labels for
     * addresses of accounts and transactions.
     */
    readonly addr: AddressLabels,
    readonly ammanClient: AmmanClient,
    readonly errorResolver?: ErrorResolver
  ) {}
  private static _instance: Amman | undefined

  /**
   * Generates a keypair and returns its public key and the keypair itself as a Tuple.
   *
   * @param label if provided the key will be added to existing labels
   * @return [publicKey, keypair ]
   */
  genKeypair: GenKeypair = (label?: string) => {
    return this.addr.genKeypair(label)
  }

  /**
   * Drops the specified amount of tokens to the provided public key.
   *
   * @param connection to solana JSON RPC node
   * @param publicKey to drop sols to
   * @param sol amount of sols to drop
   *
   * @category utils
   */
  async airdrop(connection: Connection, publicKey: PublicKey, sol = 1) {
    const sig = await connection.requestAirdrop(
      publicKey,
      sol * LAMPORTS_PER_SOL
    )
    const receiverLabel = this.addr.resolve(publicKey)
    const receiver = receiverLabel == null ? '' : ` -> ${receiverLabel}`
    this.addr.addLabel(`🪂 ${sol} SOL${receiver}`, sig)

    const signatureResult = await connection.confirmTransaction(sig)
    return { signature: sig, signatureResult }
  }

  /**
   * Provides a {@link TransactionHandler} which uses the {@link payer} to sign transactions.
   */
  payerTransactionHandler(connection: Connection, payer: Keypair) {
    this.addr.addLabelIfUnknown('payer', payer.publicKey)
    return new PayerTransactionHandler(connection, payer, this.errorResolver)
  }

  /**
   * Provides a {@link AmmanMockStorageDriver} which stores uploaded data on
   * the filesystem inside a tmp directory.
   * The {@link MockStorageServer} initialized with the same {@link storageId}
   * serves the files from there.
   *
   * @category storage
   */
  createMockStorageDriver = (
    storageId: string,
    uploadRoot: string,
    options?: AmmanMockStorageDriverOptions
  ) => AmmanMockStorageDriver.create(storageId, uploadRoot, options)

  /**
   * Disconnects the amman relay client and allows the app to shut down.
   * Only needed if you set `{ autoUnref: false }` for the amman client opts.
   */
  disconnect() {
    this.ammanClient.disconnect()
    logDebug('AmmanClient disconnected')
  }
  /**
   * Creates an instance of {@link Amman}.
   *
   * @param args
   * @param args.knownLabels label keys that do not change, i.e. `{ [PROGRM_ID]:  'My Program' }`
   * @param args.log used to log labels that are added to {@link
   * Amman.addresses} and information about other events
   * @param args.connectClient used to determine if to connect an amman client
   * if no {@link args.ammanClient} is provided; defaults to connect unless running in a CI environment
   * @param args.ammanClient allows to override the client used to connect to the amman validator
   * @param args.ammanClientOpts allows to specify options for the amman relay client instead
   * @param args.errorResolver used to resolve a known errors
   * from the program logs, see {@link https://github.com/metaplex-foundation/cusper}
   * @param args.transactionLabelMapper function to replace key strings in a
   * label to enhance it, i.e. with an icon
   */
  static instance(
    args: {
      knownLabels?: Record<string, string>
      log?: (msg: string) => void
      ammanClient?: AmmanClient
      connectClient?: boolean
      ammanClientOpts?: AmmanClientOpts
      errorResolver?: ErrorResolver
      transactionLabelMapper?: TransactionLabelMapper
    } = {}
  ) {
    if (Amman._instance != null) {
      return Amman._instance
    }
    const { connectClient = process.env.CI == null, ammanClientOpts } = args
    const {
      knownLabels = {},
      log = (_) => {},
      ammanClient = connectClient
        ? ConnectedAmmanClient.getInstance(AMMAN_RELAY_URI, ammanClientOpts)
        : new DisconnectedAmmanClient(),
    } = args
    ammanClient.clearAddressLabels()
    const addAddressLabels = AddressLabels.setInstance(
      knownLabels ?? {},
      log,
      ammanClient
    )
    Amman._instance = new Amman(
      addAddressLabels,
      ammanClient,
      args.errorResolver
    )
    return Amman._instance
  }

  /** @internal */
  static get expectInstance() {
    if (Amman._instance == null) {
      throw new Error('Amman instance not created but was expected')
    }
    return Amman._instance
  }
}
