#![cfg(feature = "test-sbf")]

use crate::utils::{dump_account, program_test};
use amman_mod::ixs;
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program_test::*;

use solana_sdk::{
    signature::Keypair, signer::Signer, transaction::Transaction,
};

mod utils;

#[derive(Debug, BorshSerialize, BorshDeserialize)]
struct SampleData {
    name: String,
    age: u8,
    pets: Vec<String>,
}

#[tokio::test]
async fn add_account() {
    let mut context = program_test().start_with_context().await;
    let target = Keypair::new();

    let data = SampleData {
        name: "John".to_string(),
        age: 30,
        pets: vec!["Fido".to_string(), "Spot".to_string()],
    };
    let data_vec = data.try_to_vec().unwrap();
    let ix = ixs::add_account(
        context.payer.pubkey(),
        target.pubkey(),
        data_vec,
        None,
    )
    .expect("failed to create instruction");

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&context.payer.pubkey()),
        &[&context.payer, &target],
        context.last_blockhash,
    );

    context
        .banks_client
        .process_transaction(tx)
        .await
        .expect("Failed adding account");

    dump_account::<SampleData>(&mut context, &target.pubkey()).await;
}

#[tokio::test]
#[should_panic]
async fn add_account_and_assign_owner() {
    let mut context = program_test().start_with_context().await;
    let target = Keypair::new();

    // This test demonstrates that there is no way to create an account with data and have it be
    // owned by any other program than the one setting the data. Following are the reasons:
    //
    // - an account's data can only be modified by the account's owner program
    // - once the account has an owner other than the system program, we can no longer change it
    //
    // I tried the following alternatives:
    //
    // A. Cretae account with the desired owner (other than the program) and assign data in one
    //    transaction. This failed since the data is modified, but at the end the program is not
    //    the owner and that isn't allowed.
    // B. Create the account with data in one transaction and use system_program::assign directly
    //    to change the owner which failed.
    //
    // The attempt here to do the same via CPI as part of an instruction of this program fails as
    // well

    // 1. Add Account
    {
        let data = SampleData {
            name: "John".to_string(),
            age: 30,
            pets: vec!["Fido".to_string(), "Spot".to_string()],
        };
        let data_vec = data.try_to_vec().unwrap();
        let ix = ixs::add_account(
            context.payer.pubkey(),
            target.pubkey(),
            data_vec,
            None,
        )
        .expect("failed to create instruction");

        let tx = Transaction::new_signed_with_payer(
            &[ix],
            Some(&context.payer.pubkey()),
            &[&context.payer, &target],
            context.last_blockhash,
        );

        context
            .banks_client
            .process_transaction(tx)
            .await
            .expect("Failed adding account");

        dump_account::<SampleData>(&mut context, &target.pubkey()).await;
    }

    // 2. Changing Owner does not work once our program was assigned to be
    //   the owner once
    {
        let owner = Keypair::new();
        let ix = ixs::assign_owner(target.pubkey(), owner.pubkey())
            .expect("failed to create change owner instruction");

        let tx = Transaction::new_signed_with_payer(
            &[ix],
            Some(&context.payer.pubkey()),
            &[&context.payer, &target, &owner],
            context.last_blockhash,
        );

        context
            .banks_client
            .process_transaction(tx)
            .await
            .expect("Failed changing owner");

        dump_account::<SampleData>(&mut context, &target.pubkey()).await;
    }
}
