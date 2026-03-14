use anchor_lang::prelude::*;
use anchor_spl::token_interface::{burn, Burn, Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::error::StablecoinError;
use crate::events::*;
use crate::state::*;

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    pub burner: Signer<'info>,

    #[account(
        mut,
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump = config.bump,
        constraint = !config.paused @ StablecoinError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), &[RoleType::Burner as u8], burner.key().as_ref()],
        bump = burner_role.bump,
        constraint = burner_role.active @ StablecoinError::RoleInactive,
    )]
    pub burner_role: Account<'info, RoleAccount>,

    #[account(
        mut,
        constraint = mint.key() == config.mint @ StablecoinError::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    /// Token account to burn from. Must be owned by the burner.
    #[account(
        mut,
        constraint = token_account.mint == mint.key() @ StablecoinError::MintMismatch,
        constraint = token_account.owner == burner.key() @ StablecoinError::AuthorityMismatch,
    )]
    pub token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, StablecoinError::ZeroAmount);

    let config = &mut ctx.accounts.config;
    config.total_burned = config
        .total_burned
        .checked_add(amount)
        .ok_or(StablecoinError::Overflow)?;

    // The burner signs the transaction and owns the token account,
    // so we use a plain CpiContext (no PDA signer needed).
    burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.burner.to_account_info(),
            },
        ),
        amount,
    )?;

    let clock = Clock::get()?;
    emit!(TokensBurned {
        mint: config.mint,
        from: ctx.accounts.token_account.key(),
        amount,
        burner: ctx.accounts.burner.key(),
        total_burned: config.total_burned,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
