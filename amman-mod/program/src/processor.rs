use borsh::BorshDeserialize;
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    pubkey::Pubkey,
    system_instruction,
};

use crate::{
    check_id,
    ixs::AmmanModInstruction,
    utils::{
        accounts::{
            allocate_account_and_assign_owner, minimum_rent_exempt,
            AllocateAndAssignAccountArgs,
        },
        assert_is_signer, assert_keys_equal,
    },
    AmmanModError,
};

pub fn process<'a>(
    program_id: &'a Pubkey,
    accounts: &'a [AccountInfo<'a>],
    instruction_data: &[u8],
) -> ProgramResult {
    check_id(program_id);

    let instruction = AmmanModInstruction::try_from_slice(instruction_data)?;

    use AmmanModInstruction::*;
    match instruction {
        AddAccount {
            from_pubkey,
            to_pubkey,
            data,
            lamports,
        } => process_add_account(
            from_pubkey,
            to_pubkey,
            data,
            lamports,
            accounts,
            program_id,
        )?,
        AssignOwner => process_assign_owner(accounts, program_id)?,
    }

    Ok(())
}

fn process_add_account<'a>(
    from_pubkey: Pubkey,
    to_pubkey: Pubkey,
    data: Vec<u8>,
    lamports: Option<u64>,
    accounts: &'a [AccountInfo<'a>],
    program_id: &'a Pubkey,
) -> ProgramResult {
    msg!("IX: add account");

    let min_rent = minimum_rent_exempt(data.len())?;
    let lamports = {
        let lamports = lamports.unwrap_or(min_rent);
        if lamports < min_rent {
            msg!(
                "Insufficient lamports ({}) to add account with data size {}",
                lamports,
                data.len()
            );
            return Err(AmmanModError::InsufficientFunds.into());
        }
        lamports
    };

    let account_info_iter = &mut accounts.iter();
    let payer_info = next_account_info(account_info_iter)?;
    let target_info = next_account_info(account_info_iter)?;
    let program_info = next_account_info(account_info_iter)?;

    // Verify accounts match the instruction arg keys
    assert_keys_equal(&from_pubkey, payer_info.key, || {
        format!(
            "from_pubkey: ({}) != payer account ({}), ",
            from_pubkey, payer_info.key
        )
    })?;
    assert_keys_equal(&to_pubkey, target_info.key, || {
        format!(
            "to_pubkey: ({}) != target account ({}), ",
            to_pubkey, target_info.key
        )
    })?;
    assert_keys_equal(program_id, program_info.key, || {
        format!(
            "program_id: ({}) != program account ({})",
            program_id, program_info.key
        )
    })?;

    // Verify signers
    assert_is_signer(payer_info, "from_pubkey  (payer)")?;
    assert_is_signer(target_info, "to_pubkey  (target)")?;

    // Allocate and assign account
    // An account's data can only be modified by the account's Owner program
    allocate_account_and_assign_owner(AllocateAndAssignAccountArgs {
        payer_info,
        account_info: target_info,
        owner: program_info.key,
        size: data.len(),
        lamports,
    })?;

    // Store data into account
    target_info
        .try_borrow_mut_data()?
        .as_mut()
        .copy_from_slice(&data);

    Ok(())
}

fn process_assign_owner(
    accounts: &[AccountInfo],
    program_id: &Pubkey,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let target_info = next_account_info(account_info_iter)?;
    let owner_info = next_account_info(account_info_iter)?;
    let program_info = next_account_info(account_info_iter)?;

    assert_keys_equal(program_id, program_info.key, || {
        format!(
            "program_id: ({}) != program account ({})",
            program_id, program_info.key
        )
    })?;

    // Fails: instruction illegally modified the program id of an account
    invoke_signed(
        &system_instruction::assign(target_info.key, owner_info.key),
        // 0. `[WRITE, SIGNER]` Assigned account public key
        &[target_info.clone(), owner_info.clone()],
        &[],
    )
}
