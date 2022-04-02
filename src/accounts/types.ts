import { Account, Mint } from '@solana/spl-token'

export function isMint(value: any): value is Mint {
  const mint = value as Mint
  return typeof mint.supply === 'bigint' && typeof mint.decimals === 'number'
}

export function isAccount(value: any): value is Account {
  const account = value as Account
  return (
    account.mint != null &&
    account.owner != null &&
    typeof account.amount === 'bigint'
  )
}
