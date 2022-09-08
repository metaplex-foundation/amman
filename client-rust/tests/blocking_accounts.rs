mod utils;
use utils::TestSetup;

use amman_rust_client::amman_config::Account;
use amman_rust_client::blocking::AmmanClient;
use amman_rust_client::AmmanProcess;

use std::{fs, path::PathBuf};

fn setup() -> (AmmanClient, AmmanProcess) {
    let client = AmmanClient::new(None);
    let mut amman = AmmanProcess::new(client.clone());
    amman.ensure_started().unwrap();
    (client, amman)
}

// -----------------
// Accounts
// -----------------
#[test]
fn request_account_states() {
    let (client, mut amman) = setup();
    amman.restart().expect("failed to restart amman");

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
