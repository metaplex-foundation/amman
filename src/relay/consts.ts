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
export const MSG_REQUEST_SNAPSHOT = 'request:snapshot'
/** @private */
export const MSG_RESPOND_SNAPSHOT = 'respond:snapshot'

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
export const MSG_REQUEST_AMMAN_VERSION = 'request:relay-version'
/** @private */
export const MSG_RESPOND_AMMAN_VERSION = 'respond:relay-version'
