use std::{fs, path::PathBuf};

use amman_rust_client::amman_config::Account;

pub struct TestSetup {
    fixtures: PathBuf,
    assets_dir: PathBuf,
    accounts_dir: PathBuf,
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

    pub fn load_account(&self, pubkey: &str) -> (PathBuf, Account) {
        let account_path = &mut self.accounts_dir.clone();
        account_path.push(PathBuf::from(format!("{}.json", pubkey)));

        let account_json = fs::read_to_string(&account_path).expect("Failed to read account");
        let account = serde_json::from_str::<Account>(&account_json)
            .expect(&format!("Unable to parse account from {}", account_json));

        (account_path.to_path_buf(), account)
    }
}
