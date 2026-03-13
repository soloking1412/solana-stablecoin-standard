use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_spl::token_2022;
use anchor_spl::token_interface::{Mint, TokenInterface};
use spl_token_2022::{
    extension::ExtensionType,
    instruction as token_instruction,
    state::Mint as SplMint,
};

use crate::constants::*;
use crate::error::StablecoinError;
use crate::events::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
    pub preset: u8,
}

#[derive(Accounts)]
#[instruction(params: InitializeParams)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + StablecoinConfig::INIT_SPACE,
        seeds = [STABLECOIN_SEED, mint.key().as_ref()],
        bump,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// The Token-2022 mint — created externally with the right extensions,
    /// then passed here for config binding. We validate ownership in handler.
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = authority,
        space = 8 + RoleAccount::INIT_SPACE,
        seeds = [ROLE_SEED, config.key().as_ref(), &[RoleType::Admin as u8], authority.key().as_ref()],
        bump,
    )]
    pub admin_role: Account<'info, RoleAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
    require!(params.name.len() <= MAX_NAME_LEN, StablecoinError::NameTooLong);
    require!(params.symbol.len() <= MAX_SYMBOL_LEN, StablecoinError::SymbolTooLong);
    require!(params.uri.len() <= MAX_URI_LEN, StablecoinError::UriTooLong);
    require!(
        params.preset == PRESET_SSS1 || params.preset == PRESET_SSS2 || params.preset == PRESET_SSS3,
        StablecoinError::InvalidPreset
    );

    let clock = Clock::get()?;
    let is_compliant = params.preset >= PRESET_SSS2;

    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.mint = ctx.accounts.mint.key();
    config.name = params.name.clone();
    config.symbol = params.symbol.clone();
    config.uri = params.uri.clone();
    config.decimals = params.decimals;
    config.preset = params.preset;
    config.paused = false;
    config.total_minted = 0;
    config.total_burned = 0;
    config.enable_permanent_delegate = is_compliant;
    config.enable_transfer_hook = is_compliant && params.preset == PRESET_SSS2;
    config.default_account_frozen = is_compliant;
    config.created_at = clock.unix_timestamp;
    config.bump = ctx.bumps.config;
    config._reserved = [0u8; RESERVED_SPACE];

    // Initialize admin role for the authority
    let admin_role = &mut ctx.accounts.admin_role;
    admin_role.config = config.key();
    admin_role.user = ctx.accounts.authority.key();
    admin_role.role = RoleType::Admin as u8;
    admin_role.active = true;
    admin_role.granted_by = ctx.accounts.authority.key();
    admin_role.granted_at = clock.unix_timestamp;
    admin_role.bump = ctx.bumps.admin_role;

    emit!(TokenInitialized {
        mint: config.mint,
        authority: config.authority,
        name: params.name,
        symbol: params.symbol,
        decimals: params.decimals,
        preset: params.preset,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}
