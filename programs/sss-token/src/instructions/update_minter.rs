use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::StablecoinError;
use crate::events::*;
use crate::state::*;

#[derive(Accounts)]
pub struct CreateMinterQuota<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [STABLECOIN_SEED, config.mint.as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), &[RoleType::Admin as u8], admin.key().as_ref()],
        bump = admin_role.bump,
        constraint = admin_role.active @ StablecoinError::RoleInactive,
    )]
    pub admin_role: Account<'info, RoleAccount>,

    /// CHECK: The minter whose quota is being set
    pub minter: UncheckedAccount<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + MinterQuota::INIT_SPACE,
        seeds = [MINTER_SEED, config.key().as_ref(), minter.key().as_ref()],
        bump,
    )]
    pub minter_quota: Account<'info, MinterQuota>,

    pub system_program: Program<'info, System>,
}

pub fn handler_create(ctx: Context<CreateMinterQuota>, quota: u64) -> Result<()> {
    let minter_quota = &mut ctx.accounts.minter_quota;
    minter_quota.config = ctx.accounts.config.key();
    minter_quota.minter = ctx.accounts.minter.key();
    minter_quota.quota = quota;
    minter_quota.minted = 0;
    minter_quota.bump = ctx.bumps.minter_quota;

    let clock = Clock::get()?;
    emit!(MinterQuotaUpdated {
        config: ctx.accounts.config.key(),
        minter: ctx.accounts.minter.key(),
        new_quota: quota,
        updated_by: ctx.accounts.admin.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateMinterQuota<'info> {
    pub admin: Signer<'info>,

    #[account(
        seeds = [STABLECOIN_SEED, config.mint.as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), &[RoleType::Admin as u8], admin.key().as_ref()],
        bump = admin_role.bump,
        constraint = admin_role.active @ StablecoinError::RoleInactive,
    )]
    pub admin_role: Account<'info, RoleAccount>,

    /// CHECK: The minter whose quota is being updated
    pub minter: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [MINTER_SEED, config.key().as_ref(), minter.key().as_ref()],
        bump = minter_quota.bump,
    )]
    pub minter_quota: Account<'info, MinterQuota>,
}

pub fn handler_update(ctx: Context<UpdateMinterQuota>, new_quota: u64) -> Result<()> {
    let minter_quota = &mut ctx.accounts.minter_quota;
    minter_quota.quota = new_quota;

    let clock = Clock::get()?;
    emit!(MinterQuotaUpdated {
        config: ctx.accounts.config.key(),
        minter: ctx.accounts.minter.key(),
        new_quota,
        updated_by: ctx.accounts.admin.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
