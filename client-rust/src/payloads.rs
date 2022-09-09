use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Deserialize, Debug, PartialEq, Eq, Default)]
pub struct AmmanVersion([u8; 3]);
pub const CURRENT_AMMAN_VERSION: AmmanVersion = AmmanVersion([0, 12, 0]);

// -----------------
// Empty Args
// -----------------
#[derive(Serialize)]
pub struct NoArgs;

// -----------------
// Address Labels
// -----------------
pub type AddressLabelsMap = HashMap<String, String>;
#[derive(Deserialize, Debug, PartialEq, Eq, Default)]
pub struct AddressLabels {
    pub labels: AddressLabelsMap,
}

// -----------------
// Account States
// -----------------
#[derive(Deserialize, Debug, PartialEq, Eq, Default)]
pub struct AccountStates {
    pub pubkey: String,
    pub states: Vec<AccountState>,
}

#[derive(Deserialize, Debug, PartialEq, Eq, Default)]
pub struct AccountState {
    pub account: HashMap<String, Value>,
    pub rendered: String,
    pub slot: u64,
    pub timestamp: u64,
    // TODO(thlorenz): add in the below as needed
    // accountDiff?: AccountDiff;
    // renderedDiff?: Change[];
}

// -----------------
// Relay Reply
// -----------------
#[derive(Deserialize, Debug, PartialEq, Eq, Default)]
pub struct RelayReply<T> {
    pub result: Option<T>,
    pub err: Option<String>,
}

#[derive(Deserialize, Debug, PartialEq, Eq, Default)]
pub struct Outcome {
    pub err: Option<String>,
}
