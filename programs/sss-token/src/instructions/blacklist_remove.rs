use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::StablecoinError;
use crate::events::*;
use crate::state::*;

#[derive(Accounts)]
pub struct BlacklistRemove<'info> {
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

    /// CHECK: The address being removed from blacklist
    pub address: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [BLACKLIST_SEED, config.key().as_ref(), address.key().as_ref()],
        bump = blacklist_entry.bump,
        close = blacklister,
    )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,
}

pub fn handler(ctx: Context<BlacklistRemove>) -> Result<()> {
    let clock = Clock::get()?;
    emit!(AddressUnblacklisted {
        config: ctx.accounts.config.key(),
        address: ctx.accounts.address.key(),
        removed_by: ctx.accounts.blacklister.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
