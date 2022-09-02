#![allow(unused)]

pub(crate) const AMMAN_RELAY_URI: &str = "http://localhost:50474";
pub(crate) const AMMAN_RELAY_PORT: u16 = 50474;

pub(crate) const MSG_UPDATE_ADDRESS_LABELS: &str = "update:address-labels";
pub(crate) const ACK_UPDATE_ADDRESS_LABELS: &str = "ack:update:address-labels";

pub(crate) const MSG_CLEAR_ADDRESS_LABELS: &str = "clear:address-labels";

pub(crate) const MSG_CLEAR_TRANSACTIONS: &str = "clear:transactions";

pub(crate) const MSG_GET_KNOWN_ADDRESS_LABELS: &str = "get:known-address-labels";

pub(crate) const MSG_UPDATE_ACCOUNT_STATES: &str = "update:account-states";

pub(crate) const MSG_REQUEST_ACCOUNT_STATES: &str = "request:account-states";
pub(crate) const MSG_RESPOND_ACCOUNT_STATES: &str = "respond:account-states";

pub(crate) const MSG_REQUEST_SNAPSHOT_SAVE: &str = "request:snapshot-save";
pub(crate) const MSG_RESPOND_SNAPSHOT_SAVE: &str = "respond:snapshot-save";

pub(crate) const MSG_REQUEST_ACCOUNT_SAVE: &str = "request:account-save";
pub(crate) const MSG_RESPOND_ACCOUNT_SAVE: &str = "respond:account-save";

pub(crate) const MSG_REQUEST_STORE_KEYPAIR: &str = "request:store-keypair";
pub(crate) const MSG_RESPOND_STORE_KEYPAIR: &str = "respond:store-keypair";

pub(crate) const MSG_REQUEST_LOAD_KEYPAIR: &str = "request:load-keypair";
pub(crate) const MSG_RESPOND_LOAD_KEYPAIR: &str = "respond:load-keypair";

pub(crate) const MSG_REQUEST_SET_ACCOUNT: &str = "request:set-account";
pub(crate) const MSG_RESPOND_SET_ACCOUNT: &str = "respond:set-account";

pub(crate) const MSG_REQUEST_LOAD_SNAPSHOT: &str = "request:load-snapshot";
pub(crate) const MSG_RESPOND_LOAD_SNAPSHOT: &str = "respond:load-snapshot";

pub(crate) const MSG_REQUEST_AMMAN_VERSION: &str = "request:relay-version";
pub(crate) const MSG_RESPOND_AMMAN_VERSION: &str = "respond:relay-version";
