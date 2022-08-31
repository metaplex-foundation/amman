import { Commitment } from '@solana/web3.js'
import { ChildProcess } from 'child_process'
import { RelayServer } from 'src/relay/server'
import { AmmanConfig } from '../types'

/**
 * Definition of a bpf program which the test-validator loads at startup.
 *
 * @property label a human-readable label for the program.
 * @property programId the public key under which to deploy the program
 *
 * @property deployPath the path at which the program  `.so` file built via
 * `cargo build-bpf`is located
 */
export type Program = {
  label?: string
  programId: string
  deployPath: string
}

/**
 * Definition of an account which the test-validator loads at startup from a remote cluster.
 *
 * @property label a human-readable label for the account.
 * @property accountId the public key that the account is pulled from
 * @property cluster cluster endpoint to pull the accounts from instead of the default accountsCluster
 * @property executable whether or not the account is an executable program
 */
export type Account = {
  label?: string
  accountId: string
  cluster?: string
  executable?: boolean
}

/**
 * Configures the solana-test-validator started up by amman.
 *
 * @property killRunningValidators if true will kill any solana-test-validators
 * currently running on the system.
 *
 * @property programs array of {@link Program} which should be loaded into the
 * test validator
 *
 * @property accountsCluster string the default cluster that remote accounts from the
 * accounts array will be pulled from
 *
 * @property accounts array of {@link Account}
 *
 * @property jsonRpcUrl the URL at which the test validator should listen for
 * JSON RPC requests
 *
 * @property websocketUrl for the RPC websocket
 *
 * @property ledgerDir where the solana test validator writes the ledger
 * @property resetLedger if `true` the ledger is reset to genesis at startup
 * @property limitLedgerSize <SHRED_COUNT> keep this amount of shreds in root slots. [default: 10,000]
 *   - controls how much of the ledger you store {@link https://github.com/agjell/sol-tutorials/blob/master/solana-validator-faq.md#6b-how-big-is-the-ledger-how-much-storage-space-do-i-need-for-my-validator}
 *   - increase this in order keep to keep transactions around longer for later inspection
 *
 * @property verifyFees if `true` the validator is not considered fully started
 * up until it charges transaction fees
 *
 * @property detached if `true` the `solana-test-validator` will run detached
 * which allows `amman` to exit while the validator keeps running. This
 * defaults to `true` when run in CI.
 *
 * @property feature is the feature flags you want to disable for the validator or emulate feature set of the specific network.
 */
export type ValidatorConfig = {
  killRunningValidators: boolean
  programs: Program[]
  accountsCluster: string
  accounts: Account[]
  jsonRpcUrl: string
  websocketUrl: string
  commitment: Commitment
  ledgerDir: string
  resetLedger: boolean
  limitLedgerSize: number
  verifyFees: boolean
  detached: boolean
  features?: 'mainnet' | 'devnet' | 'testnet' | string[]
}

export type AmmanState = {
  config: Required<AmmanConfig>
  validator: ChildProcess
  detached: boolean
}

/** @private only used in tests */
export type AmmanStateInternal = AmmanState & {
  relayServer?: RelayServer
}

/**
 * The type that is returned when invoking `solana feature status ...` in order
 * to obtain the features that a validator running on a specific network
 * supports.
 *
 * @private
 */
export type ValidatorFeature = {
  id: string
  description: string
  status: string
}
