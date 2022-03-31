import { Amman } from '../../api'
import { isValidPublicKeyAddress } from '../../utils'

export async function resolveAccountAddress(acc: string) {
  if (isValidPublicKeyAddress(acc)) return acc
  const amman = Amman.instance({
    ammanClientOpts: { autoUnref: false, ack: true },
  })
  const resolved = await amman.addr.resolveRemote(acc)
  amman.disconnect()
  return resolved
}
