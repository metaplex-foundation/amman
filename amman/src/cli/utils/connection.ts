import { Connection } from '@solana/web3.js'

export type ConnectionWithInternals = Connection & {
  _rpcWebSocket: { close: () => Promise<void> }
}

export async function closeConnection(
  connection: Connection,
  forceExit: boolean = false
) {
  try {
    const conn: ConnectionWithInternals = connection as ConnectionWithInternals
    if (forceExit) {
      setTimeout(() => process.exit(0), 200)
    }
    await conn._rpcWebSocket.close()
  } catch (err) {}
}
