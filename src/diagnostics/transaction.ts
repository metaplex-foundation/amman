import {
  Connection,
  TransactionSignature,
  PublicKey,
  ParsedMessageAccount,
} from '@solana/web3.js'
import BN from 'bn.js'
import { AddressLabels } from './address-labels'
import table from 'text-table'

export async function tokenBalanceFor(
  connection: Connection,
  args: { sig: TransactionSignature; mint: PublicKey; account: PublicKey }
): Promise<
  { amountPre: BN | number; amountPost: BN | number } | null | undefined
> {
  const tokenBalances = await tokenBalancesOfTransaction(connection, args.sig)
  const forAccount = tokenBalances.get(args.account.toBase58())
  if (forAccount == null) return null
  return forAccount[args.mint.toBase58()]
}

export async function tokenBalancesOfTransaction(
  connection: Connection,
  sig: TransactionSignature,
  addressLabels?: AddressLabels
): Promise<
  Map<
    string,
    Record<string, { amountPre: BN | number; amountPost: BN | number }>
  >
> {
  const parsed = await connection.getParsedTransaction(sig)
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
  for (let { mint, uiTokenAmount, accountIndex } of preTokenBalances ?? []) {
    const account = resolveAccount(accounts, accountIndex, addressLabels)
    if (account == null) continue

    mint = addressLabels?.resolveAddress(mint) ?? mint

    byAccount.set(account, {
      [mint]: { amountPre: new BN(uiTokenAmount.amount) },
    })
  }
  for (let { mint, uiTokenAmount, accountIndex } of postTokenBalances ?? []) {
    const account = resolveAccount(accounts, accountIndex, addressLabels)
    mint = addressLabels?.resolveAddress(mint) ?? mint

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
      currentMint = current[mint] = { amountPre: new BN(0) }
    }
    currentMint.amountPost = new BN(uiTokenAmount.amount)
  }

  return byAccount
}

export async function dumpTokenBalancesOfTransaction(
  connection: Connection,
  sig: TransactionSignature,
  addressLabels?: AddressLabels,
  log: Console['log'] & { enabled?: boolean } = console.log
) {
  if (typeof log?.enabled !== 'undefined' && !log?.enabled) return

  const balances = await tokenBalancesOfTransaction(
    connection,
    sig,
    addressLabels
  )
  const rows: any[] = [
    ['Address', 'Token', 'Change', 'Post Balance'],
    ['-------', '-----', '------', '------------'],
  ]

  for (const [account, mints] of balances) {
    for (const [mintAddress, { amountPre, amountPost }] of Object.entries(
      mints
    )) {
      const delta = new BN(amountPost).sub(new BN(amountPre))
      const row = [account, mintAddress, delta, `${amountPost} tokens`]
      rows.push(row)
    }
  }
  log(table(rows))
}

function resolveAccount(
  accounts: ParsedMessageAccount[],
  accountIndex: number,
  addressLabels?: AddressLabels
) {
  const parsedAccount = accounts[accountIndex]
  return (
    addressLabels?.resolveAddress(parsedAccount.pubkey.toBase58()) ??
    parsedAccount.pubkey.toBase58()
  )
}
