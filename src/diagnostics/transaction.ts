import { Connection, TransactionSignature, PublicKey } from '@solana/web3.js'
import { strict as assert } from 'assert'

export async function tokenBalanceFor(
  connection: Connection,
  args: { sig: TransactionSignature; mint: PublicKey; owner: PublicKey }
): Promise<{ amountPre: number; amountPost: number } | null | undefined> {
  const tokenBalances = await tokenBalancesOfTransaction(connection, args.sig)
  const forOwner = tokenBalances.get(args.owner.toBase58())
  if (forOwner == null) return null
  return forOwner[args.mint.toBase58()]
}

export async function tokenBalancesOfTransaction(
  connection: Connection,
  sig: TransactionSignature
): Promise<
  Map<string, Record<string, { amountPre: number; amountPost: number }>>
> {
  const parsed = await connection.getParsedTransaction(sig)
  const preTokenBalances = parsed?.meta?.preTokenBalances
  const postTokenBalances = parsed?.meta?.postTokenBalances
  if (preTokenBalances == null && postTokenBalances == null) return new Map()

  const byOwner = new Map()
  for (const { mint, owner, uiTokenAmount } of preTokenBalances ?? []) {
    byOwner.set(owner, {
      [mint]: { amountPre: parseInt(uiTokenAmount.amount) },
    })
  }
  for (const { mint, owner, uiTokenAmount } of postTokenBalances ?? []) {
    const current = byOwner.get(owner)
    assert(
      current != null,
      'should have pre token balance for each post token balance'
    )
    const currentMint = current[mint]
    assert(
      currentMint != null,
      'should have pre token balance for mint for each post token balance'
    )
    currentMint.amountPost = parseInt(uiTokenAmount.amount)
  }

  return byOwner
}
