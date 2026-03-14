use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    freeze_account as spl_freeze, FreezeAccount, Mint, TokenAccount, TokenInterface,
};

use crate::constants::*;
use crate::error::StablecoinError;
use crate::events::*;
use crate::state::*;

#[derive(Accounts)]
pub struct FreezeTokenAccount<'info> {
    pub freezer: Signer<'info>,

    #[account(
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), &[RoleType::Freezer as u8], freezer.key().as_ref()],
        bump = freezer_role.bump,
        constraint = freezer_role.active @ StablecoinError::RoleInactive,
    )]
    pub freezer_role: Account<'info, RoleAccount>,

    #[account(
        constraint = mint.key() == config.mint @ StablecoinError::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = token_account.mint == mint.key() @ StablecoinError::MintMismatch,
        constraint = !token_account.is_frozen() @ StablecoinError::AccountAlreadyFrozen,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<FreezeTokenAccount>) -> Result<()> {
    let mint_key = ctx.accounts.mint.key();
    let seeds = &[
        STABLECOIN_SEED,
        mint_key.as_ref(),
        &[ctx.accounts.config.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    spl_freeze(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        FreezeAccount {
            account: ctx.accounts.token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.config.to_account_info(),
        },
        signer_seeds,
    ))?;

    let clock = Clock::get()?;
    emit!(AccountFrozen {
        mint: ctx.accounts.config.mint,
        account: ctx.accounts.token_account.key(),
        frozen_by: ctx.accounts.freezer.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
