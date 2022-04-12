import { Commitment } from '@solana/web3.js'

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
 * Configures the solana-test-validator started up by amman.
 *
 * @property killRunningValidators if true will kill any solana-test-validators
 * currently running on the system.
 *
 * @property programs array of {@link Program} which should be loaded into the
 * test validator
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
 */
export type ValidatorConfig = {
  killRunningValidators: boolean
  programs: Program[]
  jsonRpcUrl: string
  websocketUrl: string
  commitment: Commitment
  ledgerDir: string
  resetLedger: boolean
  limitLedgerSize: number
  verifyFees: boolean
  detached: boolean
}
