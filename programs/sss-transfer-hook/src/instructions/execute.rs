use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::error::TransferHookError;
use crate::state::*;

#[derive(Accounts)]
pub struct Execute<'info> {
    /// CHECK: source token account — passed by Token-2022
    pub source: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: destination token account — passed by Token-2022
    pub destination: UncheckedAccount<'info>,

    /// CHECK: owner/delegate of source — passed by Token-2022
    pub owner: UncheckedAccount<'info>,

    /// CHECK: extra account metas PDA
    #[account(
        seeds = [EXTRA_METAS_SEED, mint.key().as_ref()],
        bump,
    )]
    pub extra_account_metas: UncheckedAccount<'info>,

    /// CHECK: stablecoin config PDA — extra meta [0]
    pub stablecoin_config: UncheckedAccount<'info>,

    /// CHECK: source blacklist PDA — extra meta [1].
    /// If the account exists and has data, source is blacklisted.
    pub source_blacklist: UncheckedAccount<'info>,

    /// CHECK: destination blacklist PDA — extra meta [2].
    /// If the account exists and has data, destination is blacklisted.
    pub destination_blacklist: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<Execute>, _amount: u64) -> Result<()> {
    // Fail-closed: if the blacklist PDA exists and has data, block the transfer.
    // An empty/uninitialized account means the address is NOT blacklisted.

    let source_bl = &ctx.accounts.source_blacklist;
    if source_bl.data_len() > 0 && source_bl.owner != &System::id() {
        return Err(TransferHookError::SourceBlacklisted.into());
    }

    let dest_bl = &ctx.accounts.destination_blacklist;
    if dest_bl.data_len() > 0 && dest_bl.owner != &System::id() {
        return Err(TransferHookError::DestinationBlacklisted.into());
    }

    Ok(())
}
