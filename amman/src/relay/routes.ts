import {
  AmmanRequest,
  MSG_UPDATE_ADDRESS_LABELS,
  MSG_GET_KNOWN_ADDRESS_LABELS,
  MSG_REQUEST_ACCOUNT_STATES,
  MSG_REQUEST_SNAPSHOT_SAVE,
  MSG_REQUEST_ACCOUNT_SAVE,
  MSG_REQUEST_STORE_KEYPAIR,
  MSG_REQUEST_LOAD_KEYPAIR,
  MSG_REQUEST_SET_ACCOUNT,
  MSG_REQUEST_LOAD_SNAPSHOT,
  MSG_REQUEST_RESTART_VALIDATOR,
  MSG_REQUEST_AMMAN_VERSION,
  MSG_REQUEST_VALIDATOR_PID,
  AMMAN_RELAY_URI,
  MSG_REQUEST_KILL_AMMAN,
} from '@metaplex-foundation/amman-client'
import { UnreachableCaseError } from 'ts-essentials'

export const RELAY_REST_PATH = 'relay'
export const RELAY_REST_PATH_LEN = RELAY_REST_PATH.length
export const RELAY_METHODS = ['POST', 'GET'] as const
export type RelayMethod = typeof RELAY_METHODS[number]
export type Route = { method: RelayMethod; url: string }

export class AmmanRelayRoutes {
  constructor(readonly rootUrl: string = AMMAN_RELAY_URI) {}

  urlAndMethodForRequest(request: AmmanRequest): Route {
    const method = this.methodForRequest(request)
    return {
      method,
      url: `${this.rootUrl}/${RELAY_REST_PATH}/${request}`,
    }
  }

  methodForRequest(request: AmmanRequest): RelayMethod {
    switch (request) {
      case MSG_GET_KNOWN_ADDRESS_LABELS:
      case MSG_REQUEST_ACCOUNT_STATES:
      case MSG_REQUEST_AMMAN_VERSION:
      case MSG_REQUEST_VALIDATOR_PID:
        return 'GET'
      case MSG_UPDATE_ADDRESS_LABELS:
      case MSG_REQUEST_ACCOUNT_STATES:
      case MSG_REQUEST_SNAPSHOT_SAVE:
      case MSG_REQUEST_ACCOUNT_SAVE:
      case MSG_REQUEST_STORE_KEYPAIR:
      case MSG_REQUEST_LOAD_KEYPAIR:
      case MSG_REQUEST_SET_ACCOUNT:
      case MSG_REQUEST_LOAD_SNAPSHOT:
      case MSG_REQUEST_RESTART_VALIDATOR:
      case MSG_REQUEST_KILL_AMMAN:
        return 'POST'
      default:
        throw new UnreachableCaseError(request)
    }
  }
}

export function ammanRelayRoutes(rootUrl?: string) {
  return new AmmanRelayRoutes(rootUrl)
}
