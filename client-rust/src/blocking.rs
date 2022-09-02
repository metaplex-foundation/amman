use serde::{de::DeserializeOwned, Serialize};
use std::fmt::Debug;

use reqwest::blocking as req;

use crate::{
    consts::{
        AMMAN_RELAY_URI, MSG_GET_KNOWN_ADDRESS_LABELS, MSG_REQUEST_ACCOUNT_STATES,
        MSG_REQUEST_AMMAN_VERSION, MSG_UPDATE_ADDRESS_LABELS,
    },
    errors::{AmmanClientError, AmmanClientResult},
    payloads::{AccountState, AddressLabels, AmmanVersion, Outcome, ResultOutcome},
};

pub struct AmmanClient {
    uri: String,
}

impl AmmanClient {
    pub fn new(amman_relay_uri: Option<String>) -> Self {
        let uri = amman_relay_uri.unwrap_or_else(|| AMMAN_RELAY_URI.to_string());
        Self { uri }
    }

    fn amman_get<T: DeserializeOwned + Debug>(&self, path: &str) -> AmmanClientResult<T> {
        // let result = req::get(format!("{uri}/{path}", uri = self.uri, path = path))?.text()?;
        // eprintln!("{:#?}", result);
        let result = req::get(format!("{uri}/{path}", uri = self.uri, path = path))?
            .json::<ResultOutcome<T>>()?;

        if let Some(err) = result.err {
            return Err(AmmanClientError::RelayResponseHasError(err));
        };

        if let Some(result) = result.result {
            Ok(result)
        } else {
            Err(AmmanClientError::RelayResponseHasNeitherResultAndError)
        }
    }

    fn amman_post<Args: Serialize + ?Sized>(
        &self,
        path: &str,
        payload: &Args,
    ) -> AmmanClientResult<()> {
        let result = req::Client::new()
            .post(format!("{uri}/{req}", uri = self.uri, req = path))
            .json(payload)
            .send()?
            .json::<Outcome>()?;

        if let Some(err) = result.err {
            return Err(AmmanClientError::RelayResponseHasError(err));
        };
        Ok(())
    }

    fn amman_post_with_result<T: DeserializeOwned, Args: Serialize + ?Sized>(
        &self,
        path: &str,
        payload: &Args,
    ) -> AmmanClientResult<ResultOutcome<T>> {
        #[cfg(test)]
        {
            let body = req::Client::new()
                .post(format!("{uri}/{req}", uri = self.uri, req = path))
                .json(payload)
                .send()?
                .text()?;
            eprintln!("{:#?}", body);
        }

        let result = req::Client::new()
            .post(format!("{uri}/{req}", uri = self.uri, req = path))
            .json(payload)
            .send()?
            .json::<ResultOutcome<T>>()?;

        Ok(result)
    }

    pub fn request_amman_version(&self) -> Result<AmmanVersion, AmmanClientError> {
        self.amman_get::<AmmanVersion>(MSG_REQUEST_AMMAN_VERSION)
    }

    // -----------------
    // Address Labels
    // -----------------
    pub fn request_known_address_labels(&self) -> Result<AddressLabels, AmmanClientError> {
        self.amman_get::<AddressLabels>(MSG_GET_KNOWN_ADDRESS_LABELS)
    }

    pub fn request_update_address_labels(
        &self,
        address_labels: &AddressLabels,
    ) -> AmmanClientResult<()> {
        self.amman_post(MSG_UPDATE_ADDRESS_LABELS, &vec![address_labels])
    }

    // -----------------
    // Accounts
    // -----------------
    pub fn request_account_states(
        &self,
        address: &str,
    ) -> AmmanClientResult<ResultOutcome<(String, Vec<AccountState>)>> {
        self.amman_post_with_result::<(String, Vec<AccountState>), _>(
            MSG_REQUEST_ACCOUNT_STATES,
            &vec![address],
        )
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::payloads::CURRENT_AMMAN_VERSION;

    use super::*;

    #[test]
    fn amman_version() {
        let client = AmmanClient::new(None);
        let version = client
            .request_amman_version()
            .expect("should return OK amman version");
        assert_eq!(version, CURRENT_AMMAN_VERSION, "fetches correct version");
    }

    // -----------------
    // Address Labels
    // -----------------
    #[test]
    fn known_address_labels() {
        let client = AmmanClient::new(None);
        let labels = client
            .request_known_address_labels()
            .expect("should return OK address labels response");
        eprintln!("{:#?}", labels);
    }

    #[test]
    fn update_address_labels() {
        let client = AmmanClient::new(None);
        let labels = {
            let mut map = HashMap::<String, String>::new();
            map.insert("some address".to_string(), "some label".to_string());
            map
        };
        client
            .request_update_address_labels(&labels)
            .expect("should work");
        let labels = client.request_known_address_labels().expect("should work");
        eprintln!("{:#?}", labels);
    }

    // -----------------
    // Accounts
    // -----------------
    #[test]
    fn request_account_states() {
        let client = AmmanClient::new(None);
        let labels = client
            .request_known_address_labels()
            .expect("should get address labels");

        let game_pda_address = labels
            .iter()
            .find_map(|(k, v)| if v == "gamePda" { Some(k) } else { None })
            .expect("Make sure to populate amman with game data first");

        let states = client
            .request_account_states(game_pda_address)
            .expect("request_account_states should work");
        eprintln!("{:#?}", states);
    }
}
