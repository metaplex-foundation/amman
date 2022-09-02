use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

#[derive(Deserialize, Debug, PartialEq, Eq)]
pub struct AmmanVersion([u8; 3]);
pub const CURRENT_AMMAN_VERSION: AmmanVersion = AmmanVersion([0, 10, 0]);

pub type AddressLabels = HashMap<String, String>;

#[derive(Deserialize, Debug, PartialEq, Eq)]
pub struct ResultOutcome<T> {
    pub result: Option<T>,
    pub err: Option<String>,
}

#[derive(Deserialize, Debug, PartialEq, Eq)]
pub struct Outcome {
    pub err: Option<String>,
}

#[derive(Deserialize, Debug, PartialEq, Eq)]
pub struct AccountState {
    pub account: HashMap<String, Value>,
    pub rendered: String,
    pub slot: u64,
    pub timestamp: u64,
    // TODO(thlorenz): left out the below:
    // accountDiff?: AccountDiff;
    // renderedDiff?: Change[];
}
