#![allow(unexpected_cfgs, ambiguous_glob_reexports, deprecated)]

use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("SThk8WNt3JUYTCNwUgMJeLSBbqRbGnFv6xFM4th7giQ");

#[program]
pub mod sss_transfer_hook {
    use super::*;

    pub fn initialize_extra_account_metas(ctx: Context<InitializeExtraAccountMetas>) -> Result<()> {
        instructions::initialize_extra_account_metas::handler(ctx)
    }

    pub fn execute(ctx: Context<Execute>, amount: u64) -> Result<()> {
        instructions::execute::handler(ctx, amount)
    }

    /// Fallback handler for the transfer hook interface.
    /// Token-2022 invokes the hook via a specific discriminator, and Anchor
    /// routes unrecognized discriminators here.
    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        let instruction =
            spl_transfer_hook_interface::instruction::TransferHookInstruction::unpack(data)?;

        match instruction {
            spl_transfer_hook_interface::instruction::TransferHookInstruction::Execute { amount } => {
                let amount_bytes = amount.to_le_bytes();
                // Prepend anchor discriminator for our execute instruction
                __private::__global::execute(program_id, accounts, &amount_bytes)
            }
            spl_transfer_hook_interface::instruction::TransferHookInstruction::InitializeExtraAccountMetaList { .. } => {
                __private::__global::initialize_extra_account_metas(program_id, accounts, &[])
            }
            _ => Err(ProgramError::InvalidInstructionData.into()),
        }
    }
}
