import { ErrorResolver } from '@metaplex-foundation/cusper'
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js'
import { AccountDataSerializer } from './assets/account-data-serializer'
import { MutableAccount } from './assets/persistence'
import {
  AddressLabels,
  GenKeypair,
  GenLabeledKeypair,
  LoadKeypair,
  LoadOrGenKeypair,
} from './diagnostics/address-labels'
import {
  AmmanClient,
  AmmanClientOpts,
  ConnectedAmmanClient,
  DisconnectedAmmanClient,
} from './relay/client'
import { AMMAN_RELAY_URI } from './relay/consts'
import { TransactionChecker } from './transactions/transaction-checker'
import {
  PayerTransactionHandler,
  TransactionLabelMapper,
} from './transactions/transaction-handler'
import {
  deriveFromKeypair,
  deriveFromWallet,
  deriveInsecure,
} from './utils/keypair'
import { scopedLog } from './utils/log'

const { logDebug } = scopedLog('api')

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
 *   log: console.log,
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

  // -----------------
  // Keypair
  // -----------------

  /**
   * Generates a keypair and returns its public key and the keypair itself as a
   * Tuple.
   *
   * @return [publicKey, keypair ]
   */
  genKeypair: GenKeypair = () => this.addr.genKeypair()

  /**
   * Generates a keypair, labels it and returns its public key and the keypair
   * itself as a Tuple.
   *
   * @param label the key will be added to existing labels
   * @return [publicKey, keypair ]
   */
  genLabeledKeypair: GenLabeledKeypair = (label: string) =>
    this.addr.genLabeledKeypair(label)

  /**
   * Loads a labeled {@link Keypair} from the relay.
   * If a {@link Keypair} with that label is not found or the relay is not connected, then it
   * returns `undefined`.
   */
  loadKeypair: LoadKeypair = async (label) => this.addr.loadKeypair(label)

  /**
   * Loads a labeled {@link Keypair} from the relay.
   * If a {@link Keypair} with that label is not found or the relay is not connected, then it
   * returns a newly generated keypair.
   *
   */
  loadOrGenKeypair: LoadOrGenKeypair = async (label) =>
    this.addr.loadOrGenKeypair(label)

  /**
   * Derives a keypair from a message signed with the provided keypair.
   *
   * @param message - which is signed and then used to derive the seed digest
   */
  deriveKeypairFromKeypair = deriveFromKeypair

  /**
   * Derives a keypair from a message signed with the provided wallet.
   *
   * @param message - which is signed and then used to derive the seed digest
   */
  deriveKeypairFromWallet = deriveFromWallet

  /**
   * Derives a keypair from a message.
   *
   * **WARN: only use this for testing purposes.**
   * Use {@link deriveFromWallet} or {@link deriveFromKeypair} instead in a production environment.
   *
   * This is entirely insecure as anyone with that same message can derive the same keypair.
   *
   * @param message - from wich the seed digest is derived
   */
  deriveKeypairInsecure = deriveInsecure

  // -----------------
  // Transactions
  // -----------------

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
    const receiverLabel = await this.addr.resolveRemoteAddress(publicKey)
    const receiver = receiverLabel == null ? '' : ` -> ${receiverLabel}`
    await this.addr.addLabel(`🪂 ${sol} SOL${receiver}`, sig)

    const signatureResult = await connection.confirmTransaction(sig)
    return { signature: sig, signatureResult }
  }

  /**
   * Provides a {@link TransactionHandler} which uses the {@link payer} to sign transactions.
   * @category transactions
   */
  payerTransactionHandler(
    connection: Connection,
    payer: Keypair,
    errorResolver?: ErrorResolver
  ) {
    this.addr
      .storeKeypair(payer, 'payer')
      .then((label) => this.addr.addLabelIfUnknown('payer', label ?? 'payer'))
    return new PayerTransactionHandler(
      connection,
      payer,
      errorResolver ?? this.errorResolver
    )
  }

  /**
   * If you cannot use the {@link payerTransactionHandler} then you can use this to verify
   * the outcome of your transactions.
   * @category transactions
   * @category asserts
   */
  transactionChecker(connection: Connection, errorResolver?: ErrorResolver) {
    return new TransactionChecker(
      connection,
      errorResolver ?? this.errorResolver
    )
  }

  // -----------------
  // Validator Injection
  // -----------------
  accountModifier<T>(
    address: PublicKey,
    serializer?: AccountDataSerializer<T>,
    connection?: Connection
  ) {
    return MutableAccount.from(
      this.ammanClient.requestSetAccount.bind(this.ammanClient),
      address,
      serializer,
      connection
    )
  }

  /**
   * Provides a {@link AmmanMockStorageDriver} which stores uploaded data on
   * the filesystem inside a tmp directory.
   * The {@link MockStorageServer} initialized with the same {@link storageId}
   * serves the files from there.
   *
   * @category storage
   */
  // TODO(thlorenz): add mock storage
  /*
  createMockStorageDriver = (
    storageId: string,
    options?: AmmanMockStorageDriverOptions
  ) => AmmanMockStorageDriver.create(storageId, options)
  */

  // -----------------
  // Disposing
  // -----------------

  /**
   * Disconnects the amman relay client and allows the app to shut down.
   * Only needed if you set `{ autoUnref: false }` for the amman client opts.
   */
  disconnect() {
    this.ammanClient.disconnect()
    logDebug('AmmanClient disconnected')
  }
  /**
   * More force full version of disconnect.
   */
  destroy() {
    this.ammanClient.destroy()
    logDebug('AmmanClient destoyed')
  }

  // -----------------
  // Instantiation
  // -----------------

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
    const addAddressLabels = AddressLabels.setInstance(
      knownLabels,
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
  static get existingInstance() {
    return Amman._instance
  }
}
