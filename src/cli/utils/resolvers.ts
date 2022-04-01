import { Amman } from '../../api'
import { isValidPublicKeyAddress } from '../../utils'

export function cliAmmanInstance() {
  return Amman.instance({
    ammanClientOpts: { autoUnref: false, ack: true },
  })
}

export async function resolveAccountAddresses(
  amman: Amman,
  acc: string
): Promise<string[]> {
  if (isValidPublicKeyAddress(acc)) return [acc]
  const resolved = await amman.addr.resolveRemoteLabel(acc)
  return resolved
}
