#![allow(unused)]
use serde::de::DeserializeOwned;

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

    async fn amman_get<T: DeserializeOwned>(&self, path: &str) -> Result<T, reqwest::Error> {
        let result = reqwest::get(format!("{uri}/{req}", uri = self.uri, req = path))
            .await?
            .json::<T>()
            .await?;

        Ok(result)
    }

    pub async fn request_amman_version(&self) -> Result<AmmanVersion, reqwest::Error> {
        self.amman_get::<AmmanVersion>(MSG_REQUEST_AMMAN_VERSION)
            .await
    }

    // -----------------
    // Address Labels
    // -----------------
    pub async fn request_known_address_labels(&self) -> Result<AddressLabels, reqwest::Error> {
        self.amman_get::<AddressLabels>(MSG_GET_KNOWN_ADDRESS_LABELS)
            .await
    }
}

#[cfg(test)]
mod tests {
    use crate::payloads::CURRENT_AMMAN_VERSION;

    use super::*;

    #[tokio::test]
    async fn amman_version() {
        let client = AmmanClient::new(None);
        let version = client.request_amman_version().await.expect("should work");
        assert_eq!(version, CURRENT_AMMAN_VERSION, "fetches correct version");
    }

    #[tokio::test]
    async fn known_address_labels() {
        let client = AmmanClient::new(None);
        let labels = client
            .request_known_address_labels()
            .await
            .expect("should work");
        eprintln!("{:#?}", labels);
    }
}
