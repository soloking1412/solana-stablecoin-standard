use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::StablecoinError;
use crate::events::*;
use crate::state::*;

#[derive(Accounts)]
pub struct Unpause<'info> {
    pub pauser: Signer<'info>,

    #[account(
        mut,
        seeds = [STABLECOIN_SEED, config.mint.as_ref()],
        bump = config.bump,
        constraint = config.paused @ StablecoinError::NotPaused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), &[RoleType::Pauser as u8], pauser.key().as_ref()],
        bump = pauser_role.bump,
        constraint = pauser_role.active @ StablecoinError::RoleInactive,
    )]
    pub pauser_role: Account<'info, RoleAccount>,
}

pub fn handler(ctx: Context<Unpause>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.paused = false;

    let clock = Clock::get()?;
    emit!(TokenUnpaused {
        mint: config.mint,
        unpaused_by: ctx.accounts.pauser.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
