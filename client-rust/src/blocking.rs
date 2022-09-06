use serde::{de::DeserializeOwned, Serialize};
use std::fmt::Debug;

use reqwest::blocking as req;

use crate::{
    consts::{
        AMMAN_RELAY_URI, MSG_GET_KNOWN_ADDRESS_LABELS, MSG_REQUEST_ACCOUNT_STATES,
        MSG_REQUEST_AMMAN_VERSION, MSG_REQUEST_KILL_AMMAN, MSG_REQUEST_VALIDATOR_PID,
        MSG_UPDATE_ADDRESS_LABELS,
    },
    errors::{AmmanClientError, AmmanClientResult},
    payloads::{AccountState, AddressLabels, AddressLabelsMap, AmmanVersion, Outcome, RelayReply},
};

pub struct AmmanClient {
    uri: String,
    debug: bool,
}

impl AmmanClient {
    pub fn new(amman_relay_uri: Option<String>) -> Self {
        let uri = amman_relay_uri.unwrap_or_else(|| AMMAN_RELAY_URI.to_string());
        Self { uri, debug: false }
    }

    #[allow(unused)]
    pub(crate) fn new_debug(amman_relay_uri: Option<String>) -> Self {
        let uri = amman_relay_uri.unwrap_or_else(|| AMMAN_RELAY_URI.to_string());
        Self { uri, debug: true }
    }

    fn amman_get<T: DeserializeOwned + Debug + Default>(&self, path: &str) -> AmmanClientResult<T> {
        let uri = format!("{uri}/relay/{path}", uri = self.uri, path = path);

        #[cfg(test)]
        if self.debug {
            eprintln!("RelayReply: {:#?}", req::get(uri)?.text()?);
            return Ok(Default::default());
        }

        let result = req::get(uri)?.json::<RelayReply<T>>()?;
        if let Some(err) = result.err {
            return Err(AmmanClientError::RelayReplayHasError(err));
        };

        if let Some(result) = result.result {
            Ok(result)
        } else {
            Err(AmmanClientError::RelayReplyHasNeitherResultNorError)
        }
    }

    fn amman_post<Args: Serialize + ?Sized>(
        &self,
        path: &str,
        payload: &Args,
    ) -> AmmanClientResult<()> {
        let uri = format!("{uri}/relay/{path}", uri = self.uri, path = path);
        let result = req::Client::new()
            .post(uri)
            .json(payload)
            .send()?
            .json::<Outcome>()?;

        if let Some(err) = result.err {
            return Err(AmmanClientError::RelayReplayHasError(err));
        };
        Ok(())
    }

    fn amman_post_no_args(&self, path: &str) -> AmmanClientResult<()> {
        let uri = format!("{uri}/relay/{path}", uri = self.uri, path = path);
        let result = req::Client::new().post(uri).send()?.json::<Outcome>()?;

        if let Some(err) = result.err {
            return Err(AmmanClientError::RelayReplayHasError(err));
        };
        Ok(())
    }

    fn amman_post_with_result<T: DeserializeOwned, Args: Serialize + ?Sized>(
        &self,
        path: &str,
        payload: &Args,
    ) -> AmmanClientResult<RelayReply<T>> {
        let uri = format!("{uri}/relay/{path}", uri = self.uri, path = path);
        #[cfg(test)]
        if self.debug {
            let body = req::Client::new().post(uri.clone()).send()?.text()?;
            eprintln!("{:#?}", body);
        }

        let result = req::Client::new()
            .post(uri)
            .json(payload)
            .send()?
            .json::<RelayReply<T>>()?;

        Ok(result)
    }

    #[allow(unused)]
    fn amman_post_with_result_no_args<T: DeserializeOwned>(
        &self,
        path: &str,
    ) -> AmmanClientResult<RelayReply<T>> {
        let uri = format!("{uri}/relay/{path}", uri = self.uri, path = path);
        #[cfg(test)]
        if self.debug {
            let body = req::Client::new().post(uri.clone()).send()?.text()?;
            eprintln!("{:#?}", body);
        }

        let result = req::Client::new()
            .post(uri)
            .send()?
            .json::<RelayReply<T>>()?;

        Ok(result)
    }

    // -----------------
    // Amman Version
    // -----------------
    pub fn request_amman_version(&self) -> Result<AmmanVersion, AmmanClientError> {
        self.amman_get::<AmmanVersion>(MSG_REQUEST_AMMAN_VERSION)
    }

    // -----------------
    // Validator PID
    // -----------------
    pub fn request_validator_pid(&self) -> Result<u32, AmmanClientError> {
        self.amman_get::<u32>(MSG_REQUEST_VALIDATOR_PID)
    }

    // -----------------
    // Kill Amman
    // -----------------
    pub fn request_kill_amman(&self) -> Result<(), AmmanClientError> {
        self.amman_post_no_args(MSG_REQUEST_KILL_AMMAN)
    }

    // -----------------
    // Address Labels
    // -----------------
    pub fn request_known_address_labels(&self) -> Result<AddressLabels, AmmanClientError> {
        self.amman_get::<AddressLabels>(MSG_GET_KNOWN_ADDRESS_LABELS)
    }

    pub fn request_update_address_labels(
        &self,
        address_labels: &AddressLabelsMap,
    ) -> AmmanClientResult<()> {
        self.amman_post(MSG_UPDATE_ADDRESS_LABELS, &vec![address_labels])
    }

    // -----------------
    // Accounts
    // -----------------
    pub fn request_account_states(
        &self,
        address: &str,
    ) -> AmmanClientResult<RelayReply<(String, Vec<AccountState>)>> {
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
    use crate::test_utils::AMMAN;

    use super::*;

    fn setup() -> AmmanClient {
        assert!(AMMAN.started(), "amman should start first");
        AmmanClient::new(None)
    }

    #[test]
    fn amman_version() {
        let client = setup();
        let version = client
            .request_amman_version()
            .expect("should return OK amman version");
        assert_eq!(version, CURRENT_AMMAN_VERSION, "fetches correct version");
    }

    //
    // -----------------
    // Validator PID
    // -----------------
    #[test]
    fn validator_pid() {
        let client = setup();
        let pid = client
            .request_validator_pid()
            .expect("should return OK result");
        assert!(pid > 0, "finds the pid of running validator");
    }

    // -----------------
    // Address Labels
    // -----------------
    #[test]
    fn update_and_get_known_address_labels() {
        let key1 = "some address";
        let val1 = "some label";
        let key2 = "some other address";
        let val2 = "some other label";
        let client = setup();
        let labels = {
            let mut map = HashMap::<String, String>::new();
            map.insert(key1.to_string(), val1.to_string());
            map.insert(key2.to_string(), val2.to_string());
            map
        };
        client
            .request_update_address_labels(&labels)
            .expect("should work");

        let AddressLabels { labels } = client.request_known_address_labels().expect("should work");
        assert_eq!(labels.len(), 2, "returns the two added labels");
        assert_eq!(labels.get(key1), Some(val1.to_string()).as_ref());
        assert_eq!(labels.get(key2), Some(val2.to_string()).as_ref());
    }

    // -----------------
    // Accounts
    // -----------------
    // TODO #[test]
    fn request_account_states() {
        let client = setup();
        let result = client
            .request_known_address_labels()
            .expect("should get address labels");

        let game_pda_address = result
            .labels
            .iter()
            .find_map(|(k, v)| if v == "gamePda" { Some(k) } else { None })
            .expect("Make sure to populate amman with game data first");

        let states = client
            .request_account_states(game_pda_address)
            .expect("request_account_states should work");
        eprintln!("{:#?}", states);
    }
}
