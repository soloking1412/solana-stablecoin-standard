use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    freeze_account as spl_freeze, thaw_account as spl_thaw, transfer_checked, FreezeAccount, Mint,
    ThawAccount, TokenAccount, TokenInterface, TransferChecked,
};

use crate::constants::*;
use crate::error::StablecoinError;
use crate::events::*;
use crate::state::*;

#[derive(Accounts)]
pub struct Seize<'info> {
    pub seizer: Signer<'info>,

    #[account(
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump = config.bump,
        constraint = config.preset >= PRESET_SSS2 @ StablecoinError::ComplianceNotEnabled,
        constraint = config.enable_permanent_delegate @ StablecoinError::ComplianceNotEnabled,
    )]
    pub config: Account<'info, StablecoinConfig>,

    #[account(
        seeds = [ROLE_SEED, config.key().as_ref(), &[RoleType::Seizer as u8], seizer.key().as_ref()],
        bump = seizer_role.bump,
        constraint = seizer_role.active @ StablecoinError::RoleInactive,
    )]
    pub seizer_role: Account<'info, RoleAccount>,

    #[account(
        constraint = mint.key() == config.mint @ StablecoinError::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    /// The frozen account to seize tokens from. Must be frozen.
    #[account(
        mut,
        constraint = from_account.mint == mint.key() @ StablecoinError::MintMismatch,
        constraint = from_account.is_frozen() @ StablecoinError::AccountMustBeFrozen,
    )]
    pub from_account: InterfaceAccount<'info, TokenAccount>,

    /// Treasury or destination account for seized tokens
    #[account(
        mut,
        constraint = to_account.mint == mint.key() @ StablecoinError::MintMismatch,
    )]
    pub to_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<Seize>) -> Result<()> {
    let amount = ctx.accounts.from_account.amount;
    require!(amount > 0, StablecoinError::InsufficientBalance);

    let mint_key = ctx.accounts.mint.key();
    let seeds = &[
        STABLECOIN_SEED,
        mint_key.as_ref(),
        &[ctx.accounts.config.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    // Step 1: Thaw the frozen account so we can transfer tokens out.
    // Token-2022 blocks transfers from frozen accounts, even with permanent delegate.
    spl_thaw(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        ThawAccount {
            account: ctx.accounts.from_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.config.to_account_info(),
        },
        signer_seeds,
    ))?;

    // Step 2: Use permanent delegate authority (the config PDA) to transfer
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.from_account.to_account_info(),
                to: ctx.accounts.to_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    // Step 3: Re-freeze the account to maintain compliance state.
    // The account was frozen for a reason; seizure empties it but keeps it locked.
    spl_freeze(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        FreezeAccount {
            account: ctx.accounts.from_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.config.to_account_info(),
        },
        signer_seeds,
    ))?;

    let clock = Clock::get()?;
    emit!(TokensSeized {
        config: ctx.accounts.config.key(),
        from: ctx.accounts.from_account.key(),
        to: ctx.accounts.to_account.key(),
        amount,
        seized_by: ctx.accounts.seizer.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
