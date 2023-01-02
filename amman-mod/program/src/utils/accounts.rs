use solana_program::{
    account_info::AccountInfo,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};

use crate::error::AmmanModError;

// The below two methods create an account owned by the program, namely they initialize it.
// The required rent is deducted from the payer's account.
#[inline(always)]
pub fn transfer_lamports<'a>(
    payer_info: &AccountInfo<'a>,
    to_account_info: &AccountInfo<'a>,
    lamports: u64,
) -> Result<(), ProgramError> {
    msg!("  transfer_lamports()");
    if payer_info.lamports() < lamports {
        msg!("Err: payer has only {} lamports", payer_info.lamports());
        return Err(AmmanModError::InsufficientFunds.into());
    }
    invoke(
        &system_instruction::transfer(
            payer_info.key,
            to_account_info.key,
            lamports,
        ),
        &[payer_info.clone(), to_account_info.clone()],
    )
}

#[inline(always)]
pub fn minimum_rent_exempt(size: usize) -> Result<u64, ProgramError> {
    let rent = Rent::get()?;
    let required_lamports = rent.minimum_balance(size);
    Ok(required_lamports)
}

pub struct AllocateAndAssignAccountArgs<'a> {
    pub payer_info: &'a AccountInfo<'a>,
    pub account_info: &'a AccountInfo<'a>,
    pub owner: &'a Pubkey,
    pub size: usize,
    pub lamports: u64,
}

#[inline(always)]
pub fn allocate_account_and_assign_owner(
    args: AllocateAndAssignAccountArgs,
) -> Result<(), ProgramError> {
    let AllocateAndAssignAccountArgs {
        payer_info,
        account_info,
        owner,
        size,
        lamports,
    } = args;

    // 1. Transfer the required rent to the account
    transfer_lamports(payer_info, account_info, lamports)?;

    // 2. Allocate the space to hold data we'll set during mint initialization
    //    At this point the account is still owned by the system program
    msg!("  create_account() allocate space");
    invoke_signed(
        &system_instruction::allocate(
            account_info.key,
            size.try_into().unwrap(),
        ),
        // 0. `[WRITE, SIGNER]` New account
        &[account_info.clone()],
        &[],
    )?;

    // 3. Assign the owner of the account so that it can sign on its behalf
    msg!("  create_account() assign to owning program");
    invoke_signed(
        &system_instruction::assign(account_info.key, owner),
        // 0. `[WRITE, SIGNER]` Assigned account public key
        &[account_info.clone()],
        &[],
    )?;

    Ok(())
}
