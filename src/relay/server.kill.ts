// @ts-ignore (no declaration file)
import portPids from 'port-pid'
import { logDebug, logError, logInfo, sleep } from '../utils'

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
      if (logError.enabled) {
        logError(err)
      } else {
        console.error(err)
      }
    }
  }
}
