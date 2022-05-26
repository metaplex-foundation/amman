import { Commitment } from '@solana/web3.js'
import { promises as fs } from 'fs'

import { tmpdir } from 'os'
import path from 'path'
import { createHash } from '../utils'

export async function solanaConfig(config: {
  jsonRpcUrl: string
  websocketUrl: string
  commitment: Commitment
}) {
  const { jsonRpcUrl, websocketUrl, commitment } = config
  const configText = `---
json_rpc_url: "${jsonRpcUrl}"
websocket_url: "${websocketUrl}"
commitment: ${commitment} 
`
  const configHash = createHash(Buffer.from(configText))
  const configPath = path.join(tmpdir(), `amman-config.${configHash}.yml`)
  await fs.writeFile(configPath, configText, 'utf8')

  return { configPath, cleanupConfig: () => fs.unlink(configPath) }
}
