use serde::{de::DeserializeOwned, Serialize};
use std::fmt::Debug;

use reqwest::blocking::{self as req, Client};

use crate::{
    consts::{
        AMMAN_RELAY_URI, MSG_GET_KNOWN_ADDRESS_LABELS, MSG_REQUEST_ACCOUNT_STATES,
        MSG_REQUEST_AMMAN_VERSION, MSG_REQUEST_KILL_AMMAN, MSG_REQUEST_VALIDATOR_PID,
        MSG_UPDATE_ADDRESS_LABELS,
    },
    errors::{AmmanClientError, AmmanClientResult},
    payloads::{
        AccountStates, AddressLabels, AddressLabelsMap, AmmanVersion, NoArgs, NoResult, RelayReply,
    },
};

#[derive(Clone)]
pub struct AmmanClient {
    uri: String,
    #[cfg(test)]
    debug: bool,
}

impl AmmanClient {
    pub fn new(amman_relay_uri: Option<String>) -> Self {
        let uri = amman_relay_uri.unwrap_or_else(|| AMMAN_RELAY_URI.to_string());
        #[cfg(test)]
        {
            Self { uri, debug: false }
        }

        #[cfg(not(test))]
        {
            Self { uri }
        }
    }

    #[cfg(test)]
    #[allow(unused)]
    pub(crate) fn new_debug(amman_relay_uri: Option<String>) -> Self {
        let uri = amman_relay_uri.unwrap_or_else(|| AMMAN_RELAY_URI.to_string());
        Self { uri, debug: true }
    }

    fn amman_get<T: DeserializeOwned + Debug + Default, Args: Serialize + ?Sized>(
        &self,
        path: &str,
        payload: Option<&Args>,
    ) -> AmmanClientResult<T> {
        let uri = format!("{uri}/relay/{path}", uri = self.uri, path = path);

        #[cfg(test)]
        if self.debug {
            eprintln!("RelayReply: {:#?}", req::get(uri)?.text()?);
            return Ok(Default::default());
        }

        let builder = Client::builder().build()?.get(uri);
        let builder = match payload {
            Some(payload) => builder.json(payload),
            None => builder,
        };
        let result = builder.send()?.json::<RelayReply<T>>()?;
        if let Some(err) = result.err {
            return Err(AmmanClientError::RelayReplayHasError(err));
        };

        match result.result {
            Some(result) => Ok(result),
            None => Err(AmmanClientError::RelayReplyHasNeitherResultNorError),
        }
    }

    fn amman_post<T: DeserializeOwned, Args: Serialize + ?Sized>(
        &self,
        path: &str,
        payload: Option<&Args>,
    ) -> AmmanClientResult<T> {
        let uri = format!("{uri}/relay/{path}", uri = self.uri, path = path);
        let builder = req::Client::new().post(uri);

        let builder = match payload {
            Some(payload) => builder.json(payload),
            None => builder,
        };
        let result = builder.send()?.json::<RelayReply<T>>()?;

        if let Some(err) = result.err {
            return Err(AmmanClientError::RelayReplayHasError(err));
        };

        match result.result {
            Some(result) => Ok(result),
            None => Err(AmmanClientError::RelayReplyHasNeitherResultNorError),
        }
    }

    // -----------------
    // Amman Version
    // -----------------
    pub fn request_amman_version(&self) -> Result<AmmanVersion, AmmanClientError> {
        self.amman_get::<AmmanVersion, NoArgs>(MSG_REQUEST_AMMAN_VERSION, None)
    }

    // -----------------
    // Validator PID
    // -----------------
    pub fn request_validator_pid(&self) -> Result<u32, AmmanClientError> {
        self.amman_get::<u32, NoArgs>(MSG_REQUEST_VALIDATOR_PID, None)
    }

    // -----------------
    // Kill Amman
    // -----------------
    pub fn request_kill_amman(&self) -> Result<(), AmmanClientError> {
        self.amman_post::<NoResult, NoArgs>(MSG_REQUEST_KILL_AMMAN, None)
    }

    // -----------------
    // Address Labels
    // -----------------
    pub fn request_known_address_labels(&self) -> Result<AddressLabels, AmmanClientError> {
        self.amman_get::<AddressLabels, NoArgs>(MSG_GET_KNOWN_ADDRESS_LABELS, None)
    }

    pub fn request_update_address_labels(
        &self,
        address_labels: &AddressLabelsMap,
    ) -> AmmanClientResult<()> {
        self.amman_post::<NoResult, Vec<&AddressLabelsMap>>(
            MSG_UPDATE_ADDRESS_LABELS,
            Some(&vec![address_labels]),
        )
    }

    // -----------------
    // Accounts
    // -----------------
    pub fn request_account_states(&self, address: &str) -> AmmanClientResult<AccountStates> {
        self.amman_get::<AccountStates, Vec<&str>>(MSG_REQUEST_ACCOUNT_STATES, Some(&vec![address]))
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::payloads::CURRENT_AMMAN_VERSION;
    use crate::AmmanProcess;

    use super::*;

    fn setup() -> (AmmanClient, AmmanProcess) {
        let client = AmmanClient::new(None);
        let mut amman = AmmanProcess::new(client.clone());
        amman.ensure_started().unwrap();
        (client, amman)
    }

    #[test]
    fn amman_version() {
        let (client, _) = setup();
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
        let (client, _) = setup();
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
        let (client, _) = setup();
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
}
