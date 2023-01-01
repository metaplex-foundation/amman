use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, pubkey::Pubkey,
};

use crate::AmmanModError;

pub fn assert_keys_equal<F: FnOnce() -> String>(
    provided_key: &Pubkey,
    expected_key: &Pubkey,
    get_msg: F,
) -> ProgramResult {
    if provided_key.ne(expected_key) {
        msg!("Err: {}", get_msg());
        msg!("Err: provided {} expected {}", provided_key, expected_key);
        Err(AmmanModError::ProvidedKeyDoesNotMatch.into())
    } else {
        Ok(())
    }
}

pub fn assert_is_signer(
    account: &AccountInfo,
    account_label: &str,
) -> ProgramResult {
    if !account.is_signer {
        msg!(
            "Err: account '{}' ({}) should be signer",
            account_label,
            account.key
        );
        Err(AmmanModError::AccountShouldBeSigner.into())
    } else {
        Ok(())
    }
}
