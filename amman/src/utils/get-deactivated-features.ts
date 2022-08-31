import { spawnSync } from 'child_process'
import { ValidatorFeature } from '../validator/types'

export function getDeactivatedFeatures(url: string): string[] {
  const child = spawnSync(`solana`, [
    'feature',
    'status',
    '--display-all',
    '--url',
    url.charAt(0),
    '--output',
    'json',
  ])
  try {
    const features: ValidatorFeature[] = JSON.parse(child.stdout.toString())[
      'features'
    ]
    return features.filter((f) => f.status === 'inactive').map((f) => f.id)
  } catch (err) {
    throw new Error(`Could not parse output from solana feature status: ${err}`)
  }
}
