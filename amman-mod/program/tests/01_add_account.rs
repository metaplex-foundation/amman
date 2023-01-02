#![cfg(feature = "test-sbf")]

use crate::utils::program_test;
use amman_mod::{amman_mod_id, ixs};
use assert_matches::assert_matches;
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
    let payer = context.payer;
    let recvr = Keypair::new();

    let ix = ixs::add_account(
        payer.pubkey(),
        recvr.pubkey(),
        amman_mod_id(),
        vec![],
        None,
    )
    .expect("failed to create instruction");

    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&payer.pubkey()),
        &[&payer, &recvr],
        context.last_blockhash,
    );

    context
        .banks_client
        .process_transaction(tx)
        .await
        .expect("Failed adding account");
}
