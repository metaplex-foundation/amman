import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { CreateMint } from './create-mint-account'

/**
 * API into actions/transactions creation to use during testing.
 * Will use the {@link Connection} provided in the constructor in order to
 * query data like minimum rent exemtion.
 *
 * @category actions
 */
export class Actions {
  /**
   * Constructs an {@link Actions} class which will use the provided
   * connection to perform those actions
   * @param connection to solana cluster
   */
  constructor(private readonly connection: Connection) {}

  /**
   * Creates a mint account transaction for the provided payer.
   * Ensures that the mint account will be rent-exempt.
   * The transaction will have to be signed by the [payer].
   *
   * @return promise of { createMintTx: transaction to create the mint; mint: Keypair of the mint }
   */
  createMintAccount = (
    payer: PublicKey
  ): Promise<{ mint: Keypair; createMintTx: CreateMint }> => {
    return CreateMint.createMintAccount(this.connection, payer)
  }
}
