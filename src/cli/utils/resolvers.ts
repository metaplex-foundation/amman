import { Amman } from '../../api'
import { isValidPublicKeyAddress } from '../../utils'

export function cliAmmanInstance() {
  return Amman.instance({
    ammanClientOpts: { autoUnref: false, ack: true },
  })
}

export async function resolveAccountAddress(amman: Amman, acc: string) {
  if (isValidPublicKeyAddress(acc)) return acc
  const resolved = await amman.addr.resolveRemote(acc, true)
  return resolved
}
