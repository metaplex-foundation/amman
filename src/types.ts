import { AccountInfo } from '@solana/web3.js'
import { RelayConfig } from './relay/types'
import { ValidatorConfig } from './validator/types'

export type AmmanConfig = {
  validator: ValidatorConfig
  relay: RelayConfig
}

export type AmmanAccount = {
  pretty(): Record<string, any>
}

export type AmmanAccountProvider = {
  byteSize: number
  fromAccountInfo(
    accountInfo: AccountInfo<Buffer>,
    offset?: number
  ): [AmmanAccount, number]
  canDeserialize?(buf: Buffer, offset?: number): boolean
}

export type AmmanRenderAccount = (account: any) => string
export type AmmanAccountRendererMap = Map<any, AmmanRenderAccount>

export type AmmanDetectingAccountProvider = AmmanAccountProvider & {
  canDeserialize(buf: Buffer, offset?: number): boolean
}
