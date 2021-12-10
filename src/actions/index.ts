import { Connection, PublicKey } from '@solana/web3.js'
import { createMintAccount } from './create-mint-account'

export class Actions {
  constructor(private readonly connection: Connection) {}

  createMintAccount = (payer: PublicKey) => {
    return createMintAccount(this.connection, payer)
  }
}
