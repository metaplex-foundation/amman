use std::{fs, path::PathBuf};

use amman_rust_client::amman_config::{AmmanConfig, RelayConfig};
use serde::Deserialize;

pub struct TestSetup {
    pub fixtures: PathBuf,
    pub assets_dir: PathBuf,
    pub accounts_dir: PathBuf,
}

#[derive(Deserialize)]
pub struct SavedAccount {
    pub pubkey: String,
}

impl TestSetup {
    pub fn new() -> Self {
        let fixtures = fs::canonicalize(PathBuf::from("./tests/fixtures")).expect("fixtures");
        let assets_dir =
            fs::canonicalize(PathBuf::from("./tests/fixtures/assets")).expect("assets");
        let mut accounts_dir = assets_dir.clone();
        accounts_dir.push(PathBuf::from("accounts"));

        Self {
            fixtures,
            assets_dir,
            accounts_dir,
        }
    }

    pub fn load_account(&self, pubkey: &str) -> (SavedAccount, PathBuf) {
        let account_path = &mut self.accounts_dir.clone();
        account_path.push(PathBuf::from(format!("{}.json", pubkey)));

        let account_json = fs::read_to_string(&account_path).expect("Failed to read account");
        let account = serde_json::from_str::<SavedAccount>(&account_json)
            .expect(&format!("Unable to parse account from {}", account_json));

        (account, account_path.to_path_buf())
    }

    /// Returns a preinitialized config that prevents amman stop from killing the process running the
    /// relay which ends up being the process running the tests due to the amman child process not
    /// being detached.
    pub fn amman_config(&self) -> AmmanConfig {
        let relay = RelayConfig {
            enabled: true,
            kill_running_relay: false,
        };
        AmmanConfig::new().set_relay(relay)
    }
}
