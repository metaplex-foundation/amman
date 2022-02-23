import {
  Connection,
  ParsedMessageAccount,
  PublicKey,
  TransactionSignature,
} from '@solana/web3.js'
import BN from 'bn.js'
import table from 'text-table'
import { AddressLabels } from './address-labels'
import { resolveTokenRegistry } from './token-registry'

/**
 * Interface to query token balances of a particular transaction.
 *
 * @category diagnostics
 */
export class TokenBalances {
  private constructor(
    private readonly connection: Connection,
    private readonly signature: TransactionSignature,
    private readonly addressLabels?: AddressLabels
  ) {}

  /**
   * Provides an interfact to query token balances for the transaction with the
   * provided {@link signature}.
   *
   * If {@link addressLabels} are provided then they are used to resolve
   * account and mint addresses to more meaningful labels.
   */
  static forTransaction(
    connection: Connection,
    signature: TransactionSignature,
    addressLabels?: AddressLabels
  ) {
    return new TokenBalances(connection, signature, addressLabels)
  }

  /**
   * Gets token balance for the provided account and mint.
   */
  async balance(
    account: PublicKey,
    mint: PublicKey
  ): Promise<
    { amountPre: BN | number; amountPost: BN | number } | null | undefined
  > {
    const tokenBalances = await this.byAccountMap(true)
    const forAccount = tokenBalances.get(account.toBase58())
    if (forAccount == null) return null
    return forAccount[mint.toBase58()]
  }

  /**
   * Gets all token balances for the transaction mapped by account and then grouped
   * by mint.
   */
  async byAccountMap(
    rawAddresses = false
  ): Promise<
    Map<
      string,
      Record<
        string,
        { amountPre: BN | number; amountPost: BN | number; rawMint: string }
      >
    >
  > {
    const parsed = await this.connection.getParsedTransaction(this.signature)
    const accounts = parsed?.transaction.message.accountKeys

    const preTokenBalances = parsed?.meta?.preTokenBalances
    const postTokenBalances = parsed?.meta?.postTokenBalances
    if (
      (preTokenBalances == null && postTokenBalances == null) ||
      accounts == null
    ) {
      return new Map()
    }

    const byAccount = new Map()
    for (let {
      mint: rawMint,
      uiTokenAmount,
      accountIndex,
    } of preTokenBalances ?? []) {
      const account = this.resolveAccount(accounts, accountIndex, rawAddresses)
      if (account == null) continue

      const mint = rawAddresses
        ? rawMint
        : this.addressLabels?.resolve(rawMint) ?? rawMint

      byAccount.set(account, {
        [mint]: { amountPre: new BN(uiTokenAmount.amount), rawMint },
      })
    }
    for (let {
      mint: rawMint,
      uiTokenAmount,
      accountIndex,
    } of postTokenBalances ?? []) {
      const account = this.resolveAccount(accounts, accountIndex, rawAddresses)
      const mint = rawAddresses
        ? rawMint
        : this.addressLabels?.resolve(rawMint) ?? rawMint

      if (account == null) continue
      if (!byAccount.has(account)) {
        // The account has never been minted to before at all, thus has no pre balances
        byAccount.set(account, {})
      }
      const current = byAccount.get(account)!

      let currentMint = current[mint]
      if (currentMint == null) {
        // The account has not been minted the mint to before and thus it has no
        // pre balance. We denote this as `0` pre balance which is what the
        // solana explorer does as well.
        currentMint = current[mint] = { amountPre: new BN(0), rawMint }
      }
      currentMint.amountPost = new BN(uiTokenAmount.amount)
    }

    return byAccount
  }

  /**
   * Dumps all token balances to the console.
   */
  async dump(
    log: Console['log'] & { enabled?: boolean } = console.log
  ): Promise<TokenBalances> {
    if (typeof log?.enabled !== 'undefined' && !log?.enabled) return this
    const tokenRegistry = await resolveTokenRegistry()

    const balances = await this.byAccountMap()
    const rows: any[] = [
      ['Address', 'Token', 'Change', 'Post Balance'],
      ['-------', '-----', '------', '------------'],
    ]

    for (const [account, mints] of balances) {
      for (const [
        mintAddress,
        { amountPre, amountPost, rawMint },
      ] of Object.entries(mints)) {
        const delta = new BN(amountPost).sub(new BN(amountPre))
        const unit = tokenRegistry.get(rawMint)?.name ?? 'tokens'
        const row = [account, mintAddress, delta, `${amountPost} ${unit}`]
        rows.push(row)
      }
    }
    log(table(rows))
    return this
  }

  private resolveAccount(
    accounts: ParsedMessageAccount[],
    accountIndex: number,
    rawAddresses: boolean
  ) {
    const parsedAccount = accounts[accountIndex]
    return rawAddresses
      ? parsedAccount.pubkey.toBase58()
      : this.addressLabels?.resolve(parsedAccount.pubkey) ??
          parsedAccount.pubkey.toBase58()
  }
}
