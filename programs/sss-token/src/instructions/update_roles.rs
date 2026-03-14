use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::StablecoinError;
use crate::events::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(role_type: u8)]
pub struct GrantRole<'info> {
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

    /// CHECK: The user receiving the role
    pub user: UncheckedAccount<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + RoleAccount::INIT_SPACE,
        seeds = [ROLE_SEED, config.key().as_ref(), &[role_type], user.key().as_ref()],
        bump,
    )]
    pub role_account: Account<'info, RoleAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler_grant(ctx: Context<GrantRole>, role_type: u8) -> Result<()> {
    let role = RoleType::from_u8(role_type).ok_or(StablecoinError::InvalidRole)?;

    // Compliance roles require compliant preset
    if role.requires_compliance() {
        require!(
            ctx.accounts.config.preset >= PRESET_SSS2,
            StablecoinError::ComplianceRoleNotAllowed
        );
    }

    let clock = Clock::get()?;
    let role_account = &mut ctx.accounts.role_account;
    role_account.config = ctx.accounts.config.key();
    role_account.user = ctx.accounts.user.key();
    role_account.role = role_type;
    role_account.active = true;
    role_account.granted_by = ctx.accounts.admin.key();
    role_account.granted_at = clock.unix_timestamp;
    role_account.bump = ctx.bumps.role_account;

    emit!(RoleGranted {
        config: ctx.accounts.config.key(),
        user: ctx.accounts.user.key(),
        role: role_type,
        granted_by: ctx.accounts.admin.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(role_type: u8)]
pub struct RevokeRole<'info> {
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

    /// CHECK: The user losing the role
    pub user: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [ROLE_SEED, config.key().as_ref(), &[role_type], user.key().as_ref()],
        bump = role_account.bump,
        constraint = role_account.active @ StablecoinError::RoleInactive,
    )]
    pub role_account: Account<'info, RoleAccount>,
}

pub fn handler_revoke(ctx: Context<RevokeRole>, role_type: u8) -> Result<()> {
    let _role = RoleType::from_u8(role_type).ok_or(StablecoinError::InvalidRole)?;

    // Prevent removing yourself as admin if you're the last one
    if role_type == RoleType::Admin as u8 && ctx.accounts.user.key() == ctx.accounts.admin.key() {
        return Err(StablecoinError::LastAdmin.into());
    }

    let role_account = &mut ctx.accounts.role_account;
    role_account.active = false;

    let clock = Clock::get()?;
    emit!(RoleRevoked {
        config: ctx.accounts.config.key(),
        user: ctx.accounts.user.key(),
        role: role_type,
        revoked_by: ctx.accounts.admin.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
