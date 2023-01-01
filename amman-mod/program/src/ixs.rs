use borsh::{BorshDeserialize, BorshSerialize};
use shank::ShankInstruction;
use solana_program::{
    instruction::{AccountMeta, Instruction},
    program_error::ProgramError,
    pubkey::Pubkey,
    system_program,
};

use crate::amman_mod_id;

#[derive(BorshSerialize, BorshDeserialize, Debug, ShankInstruction)]
pub enum AmmanModInstruction {
    /// Adds an account and initializes it with the given data.
    /// This it is very similar to [solana_program::system_instruction::create_account] except that
    /// account data can be provided as part of the instruction.
    AddAccount {
        /// The account that will transfer lamports to the created account
        from_pubkey: Pubkey,

        /// Public key of the created account
        to_pubkey: Pubkey,

        /// Public key of the account to assign as the owner of the created account
        owner: Pubkey,

        /// Data to initialize the account with
        data: Vec<u8>,

        /// Amount of lamports to transfer to the created account
        /// Defaults to lamports needed to keep account rent exempt
        lamports: Option<u64>,
    },
}

pub fn add_account<T: Into<Vec<u8>>>(
    from_pubkey: Pubkey,
    to_pubkey: Pubkey,
    owner: Pubkey,
    data: T,
    lamports: Option<u64>,
) -> Result<Instruction, ProgramError> {
    let accounts = vec![
        AccountMeta::new(from_pubkey, true),
        AccountMeta::new(to_pubkey, true),
        AccountMeta::new_readonly(system_program::id(), false),
    ];
    let ix = Instruction {
        program_id: amman_mod_id(),
        accounts,
        data: AmmanModInstruction::AddAccount {
            from_pubkey,
            to_pubkey,
            owner,
            data: data.into(),
            lamports,
        }
        .try_to_vec()?,
    };

    Ok(ix)
}
