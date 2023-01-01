use solana_program::{declare_id, pubkey::Pubkey};

mod entrypoint;
mod error;
pub mod ixs;
mod processor;
pub(crate) mod utils;
pub use error::*;

declare_id!("AmmanModXXXYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

pub fn amman_mod_id() -> Pubkey {
    id()
}
