import { strict as assert } from 'assert'
import { Amman } from '../../api'

export async function handleLabelCommand(labels: string[]) {
  const record: Record<string, string> = labels.reduce(
    (acc: Record<string, string>, labelAddress) => {
      const split = labelAddress.split(':')
      assert(split.length === 2, `Invalid label '${labelAddress}'`)
      const [label, address] = split as [string, string]
      acc[label] = address
      return acc
    },
    {}
  )

  const amman = Amman.instance({
    ammanClientOpts: { autoUnref: false, ack: true },
  })
  await amman.addr.addLabels(record)
  amman.disconnect()
}

export function labelHelp() {
  return `
Adds the provided PublicKey labels to amman.

  Usage:
    amman label:key label1 label2:value2..labelN:valueN

  Examples:
    amman label payer:DTTTQyKBNPDFa3cHfFJwDWcNPRJgemSisyWaohFbMRPi
    amman label payer:DTTTQyKBNPDFa3cHfFJwDWcNPRJgemSisyWaohFbMRPi mint:3Qpz4ThuLZoera59FxF7SyqyxpFgYMaJknAJpEKX8m93
`
}
