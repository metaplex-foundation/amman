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

pub struct AllocateAndAssignAccountArgs<'a, 'b> {
    pub payer_info: &'a AccountInfo<'a>,
    pub account_info: &'a AccountInfo<'a>,
    pub owner: &'a Pubkey,
    pub size: usize,
    pub signer_seeds: &'b [&'b [u8]],
    pub lamports: u64,
}

#[inline(always)]
pub fn allocate_account_and_assign_owner(
    args: AllocateAndAssignAccountArgs,
) -> Result<(), ProgramError> {
    let rent = Rent::get()?;
    let AllocateAndAssignAccountArgs {
        payer_info,
        account_info,
        owner,
        size,
        signer_seeds,
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
        &[signer_seeds],
    )?;

    // 3. Assign the owner of the account so that it can sign on its behalf
    msg!("  create_account() assign to owning program");
    invoke_signed(
        &system_instruction::assign(account_info.key, owner),
        // 0. `[WRITE, SIGNER]` Assigned account public key
        &[account_info.clone()],
        &[signer_seeds],
    )?;

    Ok(())
}

pub struct ReallocateAccountArgs<'a> {
    pub payer_info: &'a AccountInfo<'a>,
    pub account_info: &'a AccountInfo<'a>,
    pub new_size: usize,
    pub zero_init: bool,
}

pub fn reallocate_account(
    args: ReallocateAccountArgs,
) -> Result<(), ProgramError> {
    msg!("  reallocate_account()");

    let ReallocateAccountArgs {
        payer_info,
        account_info,
        new_size,
        zero_init,
    } = args;

    // 1. Transfer the extra rent to the account
    let rent = Rent::get()?;
    let required_lamports = rent
        .minimum_balance(new_size)
        .max(1)
        .saturating_sub(account_info.lamports());

    if required_lamports > 0 {
        msg!("  reallocate_account() transfer extra rent");
        transfer_lamports(payer_info, account_info, required_lamports)?;
    }

    // 2. Reallocate to the new size
    account_info.realloc(new_size, zero_init)
}
