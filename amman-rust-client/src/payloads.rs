use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Deserialize, Debug, PartialEq, Eq)]
pub struct AmmanVersion([u8; 3]);
pub const CURRENT_AMMAN_VERSION: AmmanVersion = AmmanVersion([0, 10, 0]);

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq)]
pub struct AddressLabels(pub(crate) HashMap<String, String>);

#[derive(Deserialize, Debug, PartialEq, Eq)]
pub struct ResultOutcome<T> {
    pub result: Option<T>,
    pub err: Option<String>,
}

#[derive(Deserialize, Debug, PartialEq, Eq)]
pub struct Outcome {
    pub err: Option<String>,
}
