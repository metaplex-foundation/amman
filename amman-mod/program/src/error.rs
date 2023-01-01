use num_derive::FromPrimitive;
use solana_program::{
    decode_error::DecodeError,
    msg,
    program_error::{PrintProgramError, ProgramError},
};
use thiserror::Error;

#[derive(Clone, Debug, Eq, Error, PartialEq, FromPrimitive)]
pub enum AmmanModError {
    // -----------------
    // Common
    // -----------------
    #[error("Account should be signer")]
    AccountShouldBeSigner = 0xa44a74,

    #[error("Payer does not have sufficient lamports to fund the operation")]
    InsufficientFunds,

    #[error("Account keys should match")]
    ProvidedKeyDoesNotMatch,
    // -----------------
    // Create Account
    // -----------------
}

impl PrintProgramError for AmmanModError {
    fn print<E>(&self) {
        msg!(&self.to_string());
    }
}

impl From<AmmanModError> for ProgramError {
    fn from(e: AmmanModError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

impl<T> DecodeError<T> for AmmanModError {
    fn type_of() -> &'static str {
        "TokenOwner Error"
    }
}
