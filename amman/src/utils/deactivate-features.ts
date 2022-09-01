import { strict as assert } from 'assert'
import { spawnSync } from 'child_process'
import { ValidatorConfig, ValidatorFeature } from '../validator/types'

function getDeactivatedFeatures(network: string): string[] {
  const child = spawnSync(`solana`, [
    'feature',
    'status',
    '--display-all',
    '--url',
    network.charAt(0),
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

export function maybeDeactivateFeatures(
  args: string[],
  matchFeatures: ValidatorConfig['matchFeatures'],
  deactivateFeatures: ValidatorConfig['deactivateFeatures']
) {
  let featuresToDeactivate
  if (matchFeatures != null) {
    assert(
      deactivateFeatures == null,
      'Can only provide matchFeatures or deactivateFeatues in the validator setting, but not both'
    )
    assert(
      /devnet|testnet|mainnet(-beta)?/.test(matchFeatures),
      `matchFeatures needs to be one of 'devnet' | 'testnet' | 'mainnet-beta'`
    )
    featuresToDeactivate = getDeactivatedFeatures(matchFeatures)
  }
  if (deactivateFeatures != null) {
    assert(
      matchFeatures == null,
      'Can only provide matchFeatures or deactivateFeatues in the validator setting, but not both'
    )
    assert(
      Array.isArray(deactivateFeatures),
      'validator deactivateFeatures property needs to be an array of strings'
    )
    featuresToDeactivate = deactivateFeatures
  }

  if (featuresToDeactivate != null) {
    for (const feature of featuresToDeactivate) {
      args.push('--deactivate-feature')
      args.push(feature)
    }
  }
}
