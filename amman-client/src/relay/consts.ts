/** @private */
export const AMMAN_RELAY_PORT = 50474
/** @private */
export const AMMAN_RELAY_URI = `http://localhost:${AMMAN_RELAY_PORT}`

/** @private */
export const MSG_UPDATE_ADDRESS_LABELS = 'update:address-labels'
/** @private */
export const ACK_UPDATE_ADDRESS_LABELS = 'ack:update:address-labels'
/** @private */
export const MSG_CLEAR_ADDRESS_LABELS = 'clear:address-labels'
/** @private */
export const MSG_CLEAR_TRANSACTIONS = 'clear:transactions'

/** @private */
export const MSG_GET_KNOWN_ADDRESS_LABELS = 'get:known-address-labels'
/** @private */
export const MSG_UPDATE_ACCOUNT_STATES = 'update:account-states'

/** @private */
export const MSG_REQUEST_ACCOUNT_STATES = 'request:account-states'
/** @private */
export const MSG_RESPOND_ACCOUNT_STATES = 'respond:account-states'

/** @private */
export const MSG_REQUEST_SNAPSHOT_SAVE = 'request:snapshot-save'
/** @private */
export const MSG_RESPOND_SNAPSHOT_SAVE = 'respond:snapshot-save'

/** @private */
export const MSG_REQUEST_ACCOUNT_SAVE = 'request:account-save'
/** @private */
export const MSG_RESPOND_ACCOUNT_SAVE = 'respond:account-save'

/** @private */
export const MSG_REQUEST_STORE_KEYPAIR = 'request:store-keypair'
/** @private */
export const MSG_RESPOND_STORE_KEYPAIR = 'respond:store-keypair'

/** @private */
export const MSG_REQUEST_LOAD_KEYPAIR = 'request:load-keypair'
/** @private */
export const MSG_RESPOND_LOAD_KEYPAIR = 'respond:load-keypair'

/** @private */
export const MSG_REQUEST_SET_ACCOUNT = 'request:set-account'
/** @private */
export const MSG_RESPOND_SET_ACCOUNT = 'respond:set-account'

/** @private */
export const MSG_REQUEST_LOAD_SNAPSHOT = 'request:load-snapshot'
/** @private */
export const MSG_RESPOND_LOAD_SNAPSHOT = 'respond:load-snapshot'

/** @private */
export const MSG_REQUEST_RESTART_VALIDATOR = 'request:restart-validator'
/** @private */
export const MSG_RESPOND_RESTART_VALIDATOR = 'respond:restart-validator'

/** @private */
export const MSG_REQUEST_AMMAN_VERSION = 'request:relay-version'
/** @private */
export const MSG_RESPOND_AMMAN_VERSION = 'respond:relay-version'

/** @private */
export const MSG_REQUEST_VALIDATOR_PID = 'request:validator-pid'
/** @private */
export const MSG_RESPOND_VALIDATOR_PID = 'respond:validator-pid'

export const AmmanRequests = [
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
] as const

export type AmmanRequest = typeof AmmanRequests[number]
