use serde::Deserialize;
use std::collections::HashMap;

#[derive(Deserialize, Debug, PartialEq, Eq)]
pub struct AmmanVersion([u8; 3]);
pub const CURRENT_AMMAN_VERSION: AmmanVersion = AmmanVersion([0, 10, 0]);

#[derive(Deserialize, Debug, PartialEq, Eq)]
pub struct AddressLabels(HashMap<String, String>);
