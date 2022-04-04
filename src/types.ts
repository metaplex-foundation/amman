import { AccountInfo } from '@solana/web3.js'
import { RelayConfig } from './relay/types'
import { StorageConfig } from './storage'
import { ValidatorConfig } from './validator/types'

export type AmmanConfig = {
  validator?: ValidatorConfig
  relay?: RelayConfig
  storage?: StorageConfig
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
