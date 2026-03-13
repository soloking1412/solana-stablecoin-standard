use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::StablecoinError;
use crate::events::*;
use crate::state::*;

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [STABLECOIN_SEED, config.mint.as_ref()],
        bump = config.bump,
        constraint = config.authority == authority.key() @ StablecoinError::AuthorityMismatch,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// CHECK: The new authority
    pub new_authority: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<TransferAuthority>) -> Result<()> {
    require!(
        ctx.accounts.new_authority.key() != Pubkey::default(),
        StablecoinError::InvalidAuthority
    );

    let config = &mut ctx.accounts.config;
    let old_authority = config.authority;
    config.authority = ctx.accounts.new_authority.key();

    let clock = Clock::get()?;
    emit!(AuthorityTransferred {
        config: config.key(),
        old_authority,
        new_authority: ctx.accounts.new_authority.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
