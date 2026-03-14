#![allow(unexpected_cfgs, ambiguous_glob_reexports, deprecated)]

use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("StbMVdQRUykc9jS3bT1LCiHBqBos1awkVHFn2cFRLwR");

#[program]
pub mod sss_token {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        instructions::initialize::handler(ctx, params)
    }

    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        instructions::mint::handler(ctx, amount)
    }

    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        instructions::burn::handler(ctx, amount)
    }

    pub fn freeze_account(ctx: Context<FreezeTokenAccount>) -> Result<()> {
        instructions::freeze_account::handler(ctx)
    }

    pub fn thaw_account(ctx: Context<ThawTokenAccount>) -> Result<()> {
        instructions::thaw_account::handler(ctx)
    }

    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        instructions::pause::handler(ctx)
    }

    pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
        instructions::unpause::handler(ctx)
    }

    pub fn grant_role(ctx: Context<GrantRole>, role_type: u8) -> Result<()> {
        instructions::update_roles::handler_grant(ctx, role_type)
    }

    pub fn revoke_role(ctx: Context<RevokeRole>, role_type: u8) -> Result<()> {
        instructions::update_roles::handler_revoke(ctx, role_type)
    }

    pub fn create_minter_quota(ctx: Context<CreateMinterQuota>, quota: u64) -> Result<()> {
        instructions::update_minter::handler_create(ctx, quota)
    }

    pub fn update_minter_quota(ctx: Context<UpdateMinterQuota>, new_quota: u64) -> Result<()> {
        instructions::update_minter::handler_update(ctx, new_quota)
    }

    pub fn transfer_authority(ctx: Context<TransferAuthority>) -> Result<()> {
        instructions::transfer_authority::handler(ctx)
    }

    pub fn blacklist_add(ctx: Context<BlacklistAdd>, reason: String) -> Result<()> {
        instructions::blacklist_add::handler(ctx, reason)
    }

    pub fn blacklist_remove(ctx: Context<BlacklistRemove>) -> Result<()> {
        instructions::blacklist_remove::handler(ctx)
    }

    pub fn seize(ctx: Context<Seize>) -> Result<()> {
        instructions::seize::handler(ctx)
    }
}
