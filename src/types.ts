import { RelayConfig } from './relay/types'
import { ValidatorConfig } from './validator/types'

export type AmmanConfig = {
  validator: ValidatorConfig
  relay: RelayConfig
}
