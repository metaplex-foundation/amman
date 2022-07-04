use std::error::Error;

use serde::de::DeserializeOwned;

use reqwest::blocking as reqwest;

use crate::{
    consts::{AMMAN_RELAY_URI, MSG_GET_KNOWN_ADDRESS_LABELS, MSG_REQUEST_AMMAN_VERSION},
    payloads::{AddressLabels, AmmanVersion},
};

pub struct AmmanClient {
    uri: String,
}

impl AmmanClient {
    pub fn new(amman_relay_uri: Option<String>) -> Self {
        let uri = amman_relay_uri.unwrap_or_else(|| AMMAN_RELAY_URI.to_string());
        Self { uri }
    }

    fn amman_get<T: DeserializeOwned>(&self, path: &str) -> Result<T, Box<dyn Error>> {
        let result =
            reqwest::get(format!("{uri}/{req}", uri = self.uri, req = path))?.json::<T>()?;

        Ok(result)
    }

    pub fn request_amman_version(&self) -> Result<AmmanVersion, Box<dyn Error>> {
        self.amman_get::<AmmanVersion>(MSG_REQUEST_AMMAN_VERSION)
    }

    // -----------------
    // Address Labels
    // -----------------
    pub fn request_known_address_labels(&self) -> Result<AddressLabels, Box<dyn Error>> {
        self.amman_get::<AddressLabels>(MSG_GET_KNOWN_ADDRESS_LABELS)
    }
}

#[cfg(test)]
mod tests {
    use crate::payloads::CURRENT_AMMAN_VERSION;

    use super::*;

    #[test]
    fn amman_version() {
        let client = AmmanClient::new(None);
        let version = client.request_amman_version().expect("should work");
        assert_eq!(version, CURRENT_AMMAN_VERSION, "fetches correct version");
    }

    #[test]
    fn known_address_labels() {
        let client = AmmanClient::new(None);
        let labels = client.request_known_address_labels().expect("should work");
        eprintln!("{:#?}", labels);
    }
}
