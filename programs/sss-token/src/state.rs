use crate::constants::*;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct StablecoinConfig {
    pub authority: Pubkey,
    pub mint: Pubkey,
    #[max_len(MAX_NAME_LEN)]
    pub name: String,
    #[max_len(MAX_SYMBOL_LEN)]
    pub symbol: String,
    #[max_len(MAX_URI_LEN)]
    pub uri: String,
    pub decimals: u8,
    pub preset: u8,
    pub paused: bool,
    pub total_minted: u64,
    pub total_burned: u64,
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
    pub default_account_frozen: bool,
    pub created_at: i64,
    pub bump: u8,
    pub _reserved: [u8; RESERVED_SPACE],
}

#[account]
#[derive(InitSpace)]
pub struct RoleAccount {
    pub config: Pubkey,
    pub user: Pubkey,
    pub role: u8,
    pub active: bool,
    pub granted_by: Pubkey,
    pub granted_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MinterQuota {
    pub config: Pubkey,
    pub minter: Pubkey,
    pub quota: u64,
    pub minted: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct BlacklistEntry {
    pub config: Pubkey,
    pub address: Pubkey,
    #[max_len(MAX_REASON_LEN)]
    pub reason: String,
    pub blacklisted_by: Pubkey,
    pub blacklisted_at: i64,
    pub bump: u8,
}
