import {
  Strategy,
  TokenInfo,
  TokenInfoMap,
  TokenListContainer,
  TokenListProvider,
} from '@solana/spl-token-registry'

let tokenRegistry: TokenInfoMap | undefined = undefined

/**
 * Resolves the token registry using _static_ stragegy for speed over up-to-dateness.
 * @category diagnostics
 */
export async function resolveTokenRegistry() {
  if (tokenRegistry == null) {
    try {
      await new TokenListProvider()
        .resolve(Strategy.Static)
        .then((tokens: TokenListContainer) => {
          const tokenList = tokens.getList()
          tokenRegistry = tokenList.reduce(
            (map: TokenInfoMap, item: TokenInfo) => {
              map.set(item.address, item)
              return map
            },
            new Map()
          )
        })
    } catch (err) {
      return new Map() as TokenInfoMap
    }
  }
  return tokenRegistry as TokenInfoMap
}
