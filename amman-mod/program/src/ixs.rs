use borsh::{BorshDeserialize, BorshSerialize};
use shank::ShankInstruction;

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

        /// Amount of lamports to transfer to the created account
        /// Defaults to lamports needed to keep account rent exempt
        lamports: Option<u64>,

        /// Public key of the account to assign as the owner of the created account
        owner: Pubkey,

        /// Data to initialize the account with
        data: [u8],
    },
}
