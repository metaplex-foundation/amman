// @ts-ignore (no declaration file)
import portPids from 'port-pid'
import http from 'http'
import { logDebug, logError, logInfo, sleep } from '../utils'

/** private */
export async function killRunningServer(port: number) {
  const loggedInfoFor = new Set()
  while (true) {
    const pids = (await portPids(port)).tcp ?? []
    if (pids.length === 0) break

    const pid = pids[0]
    if (!loggedInfoFor.has(pid)) {
      logInfo(
        `Killing app (${pid}) currently running amman relay at port ${port}`
      )
      loggedInfoFor.add(pid)
    }
    try {
      process.kill(pid, 'SIGTERM')
      logDebug(`Sent 'SIGTERM' to ${pid}`)
      await sleep(2000)
    } catch (err) {
      logError(err)
    }
  }
}

export function resolveServerAddress(server: http.Server) {
  const address = server.address()!
  return typeof address === 'string'
    ? address
    : `${address.address}:${address.port}`
}

export function isValidHttpUrl(maybeUrl: string) {
  let url
  try {
    url = new URL(maybeUrl)
  } catch (_) {
    return false
  }

  return url.protocol === 'http:' || url.protocol === 'https:'
}
