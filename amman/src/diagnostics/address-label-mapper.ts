const TX = '📒'
const CREATOR = '👩‍🎨'
const CREATE = '🌱'

const labelMap: Map<RegExp, string> = new Map([
  [/^(tx|trans|transaction):?/i, TX],
  [/^(creator):?/i, CREATOR],
  [/^(create|init):?/i, CREATE],
])

export function mapLabel(label: string) {
  for (const [rx, symbol] of labelMap) {
    if (rx.test(label)) {
      return `${label.replace(rx, symbol)}`
    }
  }
  return label
}
