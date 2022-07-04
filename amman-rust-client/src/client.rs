use std::error::Error;

use serde::{de::DeserializeOwned, Deserialize};

use crate::consts::{AMMAN_RELAY_URI, MSG_REQUEST_AMMAN_VERSION};

#[derive(Deserialize, Debug, PartialEq, Eq)]
pub struct AmmanVersion([u8; 3]);

const CURRENT_AMMAN_VERSION: AmmanVersion = AmmanVersion([0, 10, 0]);

pub struct AmmanClient {
    uri: String,
}

impl AmmanClient {
    pub fn new(amman_relay_uri: Option<String>) -> Self {
        let uri = amman_relay_uri.unwrap_or_else(|| AMMAN_RELAY_URI.to_string());
        Self { uri }
    }

    async fn amman_get<T: DeserializeOwned>(&self, path: &str) -> Result<T, Box<dyn Error>> {
        let result = reqwest::get(format!("{uri}/{req}", uri = self.uri, req = path))
            .await?
            .json::<T>()
            .await?;

        Ok(result)
    }

    pub async fn amman_version(&self) -> Result<AmmanVersion, Box<dyn Error>> {
        self.amman_get::<AmmanVersion>(MSG_REQUEST_AMMAN_VERSION)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_amman_version() {
        let client = AmmanClient::new(None);
        let version = client.amman_version().await.expect("should work");
        assert_eq!(version, CURRENT_AMMAN_VERSION, "fetches correct version");
    }
}
