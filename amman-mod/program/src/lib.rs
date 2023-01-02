use solana_program::{declare_id, pubkey::Pubkey};

mod entrypoint;
mod error;
pub mod ixs;
mod processor;
pub(crate) mod utils;
pub use error::*;

declare_id!("FkS48aB7A6TdKUqXWZ3g1WpAGXFnYtN7mj5URUGhRbNJ");

pub fn amman_mod_id() -> Pubkey {
    id()
}
