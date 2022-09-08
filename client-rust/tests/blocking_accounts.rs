mod utils;
use amman_rust_client::amman_config::{Account, AmmanConfig, ValidatorConfig};
use utils::TestSetup;

use amman_rust_client::blocking::AmmanClient;
use amman_rust_client::AmmanProcess;

fn setup() -> (AmmanClient, AmmanProcess, TestSetup) {
    let client = AmmanClient::new(None);
    let amman = AmmanProcess::new(client.clone());
    let test_setup = TestSetup::new();
    (client, amman, test_setup)
}

// -----------------
// Accounts
// -----------------
#[test]
fn request_accounts_and_states() {
    let (client, mut amman, test_setup) = setup();
    let (startup_account, _) =
        test_setup.load_account("13DX32Lou1qH62xUosRyk9QnQpetbuxtEgPzbkKvQmVu");

    let amman_config = AmmanConfig::new().set_validator(ValidatorConfig {
        kill_running_validators: true,
        accounts: Some(vec![Account {
            label: Some("loaded account".to_string()),
            account_id: startup_account.pubkey,
            ..Default::default()
        }]),
        ..Default::default()
    });
    amman
        .restart(&amman_config)
        .expect("failed to restart amman");

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
