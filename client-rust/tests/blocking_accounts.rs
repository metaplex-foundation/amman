mod utils;
use amman_rust_client::amman_config::{Account, ValidatorConfig};
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

    // when started without accounts loaded
    {
        amman
            .restart(&mut test_setup.amman_config())
            .expect("failed to restart amman");

        let result = client
            .request_known_address_labels()
            .expect("should get address labels");

        let labels = &result.labels;
        assert_eq!(labels.len(), 0, "retrieves empty account labels");
    }

    // restart amman loading an account
    {
        let mut amman_config = test_setup.amman_config().set_validator(ValidatorConfig {
            accounts: Some(vec![Account {
                label: Some("loaded account".to_string()),
                account_id: startup_account.pubkey.clone(),
                ..Default::default()
            }]),
            ..Default::default()
        });
        amman
            .restart(&mut amman_config)
            .expect("failed to restart amman");

        // Account Labels
        {
            let result = client
                .request_known_address_labels()
                .expect("should get address labels");

            let labels = &result.labels;
            assert_eq!(labels.len(), 1, "retrieves one account label");
            assert_eq!(
                labels.get(&startup_account.pubkey),
                Some("loaded account".to_owned()).as_ref()
            );
        }

        // Account States
        {
            let result = client
                .request_account_states(&startup_account.pubkey)
                .expect("should get account states");
            assert_eq!(
                result.pubkey, startup_account.pubkey,
                "account states pubkey"
            );
            assert_eq!(result.states.len(), 0, "empty states");
        }
    }
}
