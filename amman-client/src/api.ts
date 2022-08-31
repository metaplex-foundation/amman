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
  StoreKeypair,
} from './diagnostics/address-labels'
import {
  AmmanClient,
  AmmanClientOpts,
  ConnectedAmmanClient,
  DisconnectedAmmanClient,
} from './relay/client'
import { AMMAN_RELAY_URI } from './relay/consts'
import { AmmanMockStorageDriver } from './storage/mock-storage-driver'
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
   * Stores the keypair in the relay using the provided label or public key as id.
   * NOTE: that this is performed byt {@link loadOrGenKeypair} and {@link
   * genLabeledKeypair} for you already, so consider using those methods
   * instead.
   */
  storeKeypair: StoreKeypair = async (keypair, label) =>
    this.addr.storeKeypair(keypair, label)

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

    // TODO(thlorenz): Tried to fix deprecated method use but am running into
    // 'signature should be bas58 encoded' issue. After attempting to fix this
    // for way too much time I put this off for now.
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
  /**
   * This is an API that allows modifying accounts via validator restart.
   * However it does not work reliably while running tests and thus should only
   * be used to experiment.
   *
   * It is still useful to modify an account and save it or create a snapshot.
   * Then you can load that account or snapshot on startup and use it in your tests.
   *
   * For use while running tests it is deprecated until we find a better
   * solution to achieve the same in a more reliable way.
   *
   * For now you can perform separate steps to get similar results:
   *
   * 1. Launch a script that will init your validator state and then use this
   *    method `accountModifier` to modify the account
   * 2. Call {@link saveSnapshot} with a <label> to save it as part of your project
   * 3. In your test that needs the account state as such use {@link
   *    loadSnapshot} to put the validator into that desired state
   *
   * Make sure to use {@link loadOrGenKeypair} in your test setup to get the
   * keypairs going along with the loaded snapshot.
   *
   *
   * @deprecated (for now)
   */
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

  restartValidator() {
    return this.ammanClient.requestRestartValidator()
  }

  loadSnapshot(label: string) {
    return this.ammanClient.requestLoadSnapshot(label)
  }

  // -----------------
  // Snapshot
  // -----------------
  /**
   * Snapshots the current state of the ledger storing the folloinwg information:
   *
   * - accounts: that amman is aware of, i.e. that were part of a transaction
   * - keypairs: that amman is aware of either via {@link storeKeypair} or that
   *   were used by the {@link payerTransactionHandler}
   *
   * You can instruct amman to load this snapshot later via: `amman start --load <label>`.
   *
   * @param label the snapshot will be stored under this label
   * @category snapshot
   */
  saveSnapshot(label: string) {
    return this.ammanClient.requestSnapshot(label)
  }

  /**
   * Provides a {@link AmmanMockStorageDriver} which stores uploaded data on
   * the filesystem inside a tmp directory.
   * The {@link MockStorageServer} initialized with the same {@link storageId}
   * serves the files from there.
   *
   * @category storage
   */
  createMockStorageDriver(storageId: string, costPerByte?: number) {
    return AmmanMockStorageDriver.create(storageId, costPerByte)
  }

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
