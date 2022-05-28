import { cliAmmanInstance } from '../utils'

export async function handleSnapshotCommand(label?: string) {
  const amman = cliAmmanInstance()
  const snapshotDir = await amman.ammanClient.requestSnapshot(label)

  amman.disconnect()

  return snapshotDir
}
