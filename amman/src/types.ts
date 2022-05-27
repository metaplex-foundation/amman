import { AccountInfo } from '@solana/web3.js'
import { SnapshotConfig } from './assets'
import { RelayConfig } from './relay/types'
import { StorageConfig } from './storage'
import { ValidatorConfig } from './validator/types'

export {
  RelayAccountState,
  AccountDiff,
} from '@metaplex-foundation/amman-client'

/**
 * Amman Config
 *
 * @property validatorConfig Validator configuration
 * @property relayConfig Relay configuration
 * @property storageConfig Mock Storage configuration
 * @property streamTransactionLogs if `true` the `solana logs` command is
 * spawned and its output piped through a prettifier, defaults to run except when in a CI environment
 */
export type AmmanConfig = {
  validator?: ValidatorConfig
  relay?: RelayConfig
  storage?: StorageConfig
  snapshot: SnapshotConfig
  streamTransactionLogs?: boolean
  assetsFolder?: string
}

export type AmmanAccount = {
  pretty(): Record<string, any>
}

/**
 * The type that an account provider needs to implement so that amman can deserialize account data.
 * @category diagnostics
 */
export type AmmanAccountProvider = {
  byteSize: number | ((args: any) => void)
  fromAccountInfo(
    accountInfo: AccountInfo<Buffer>,
    offset?: number
  ): [AmmanAccount, number]
}

export type AmmanRenderAccount = (account: any) => string
export type AmmanAccountRendererMap = Map<any, AmmanRenderAccount>
