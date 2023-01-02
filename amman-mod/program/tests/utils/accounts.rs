use borsh::BorshDeserialize;
use solana_program::{
    borsh::try_from_slice_unchecked, program_pack::Pack, pubkey::Pubkey,
    rent::Rent,
};
use solana_program_test::ProgramTestContext;
use solana_sdk::account::{Account, AccountSharedData};

#[allow(unused)]
pub async fn get_account(
    context: &mut ProgramTestContext,
    pubkey: &Pubkey,
) -> Account {
    context
        .banks_client
        .get_account(*pubkey)
        .await
        .expect("get_account(): account not found")
        .expect("get_account(): account empty")
}

#[allow(unused)]
pub async fn get_unpacked<T: Pack>(
    context: &mut ProgramTestContext,
    pubkey: &Pubkey,
) -> (Account, T) {
    let acc = get_account(context, pubkey).await;

    let value = T::unpack_unchecked(&acc.data).expect("Unable to deserialize");
    (acc, value)
}

#[allow(unused)] // it actually is in 01_create_challenge.rs
pub async fn get_deserialized<T: BorshDeserialize>(
    context: &mut ProgramTestContext,
    pubkey: &Pubkey,
) -> (Account, T) {
    let acc = get_account(context, pubkey).await;
    let value: T =
        try_from_slice_unchecked(&acc.data).expect("Unable to deserialize");
    (acc, value)
}

#[allow(unused)]
pub async fn dump_account<T: BorshDeserialize + std::fmt::Debug>(
    context: &mut ProgramTestContext,
    pubkey: &Pubkey,
) {
    let (acc, value) = get_deserialized::<T>(context, pubkey).await;
    eprintln!("{:#?}", value);
    eprintln!("{:#?}", acc);
}

#[allow(unused)]
pub async fn dump_packed_account<T: Pack + std::fmt::Debug>(
    context: &mut ProgramTestContext,
    pubkey: &Pubkey,
) {
    let (acc, value) = get_unpacked::<T>(context, pubkey).await;
    eprintln!("{:#?}", value);
    eprintln!("{:#?}", acc);
}

#[allow(unused)]
pub fn add_pack_account<T: Pack>(
    context: &mut ProgramTestContext,
    address: &Pubkey,
    value: &T,
    owner: &Pubkey,
) -> Account {
    let space = T::get_packed_len();
    let lamports = Rent::default().minimum_balance(space);

    let mut account = AccountSharedData::new(lamports, space, owner);
    let mut dst = vec![0u8; space];
    T::pack_into_slice(value, dst.as_mut_slice());
    account.set_data(dst);
    context.set_account(address, &account);

    account.into()
}
