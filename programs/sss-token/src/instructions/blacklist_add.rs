use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::StablecoinError;
use crate::events::*;
use crate::state::*;

#[derive(Accounts)]
pub struct BlacklistAdd<'info> {
    #[account(mut)]
    pub blacklister: Signer<'info>,

    #[account(
        seeds = [STABLECOIN_SEED, config.mint.as_ref()],
        bump = config.bump,
        constraint = config.preset >= PRESET_SSS2 @ StablecoinError::ComplianceNotEnabled,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), &[RoleType::Blacklister as u8], blacklister.key().as_ref()],
        bump = blacklister_role.bump,
        constraint = blacklister_role.active @ StablecoinError::RoleInactive,
    )]
    pub blacklister_role: Account<'info, RoleAccount>,

    /// CHECK: The address being blacklisted
    pub address: UncheckedAccount<'info>,

    #[account(
        init,
        payer = blacklister,
        space = 8 + BlacklistEntry::INIT_SPACE,
        seeds = [BLACKLIST_SEED, config.key().as_ref(), address.key().as_ref()],
        bump,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<BlacklistAdd>, reason: String) -> Result<()> {
    require!(reason.len() <= MAX_REASON_LEN, StablecoinError::ReasonTooLong);

    let clock = Clock::get()?;
    let entry = &mut ctx.accounts.blacklist_entry;
    entry.config = ctx.accounts.config.key();
    entry.address = ctx.accounts.address.key();
    entry.reason = reason.clone();
    entry.blacklisted_by = ctx.accounts.blacklister.key();
    entry.blacklisted_at = clock.unix_timestamp;
    entry.bump = ctx.bumps.blacklist_entry;

    emit!(AddressBlacklisted {
        config: ctx.accounts.config.key(),
        address: ctx.accounts.address.key(),
        reason,
        blacklisted_by: ctx.accounts.blacklister.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
