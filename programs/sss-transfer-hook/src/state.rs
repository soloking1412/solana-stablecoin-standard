use anchor_lang::prelude::*;

pub const EXTRA_METAS_SEED: &[u8] = b"extra-account-metas";
pub const BLACKLIST_SEED: &[u8] = b"blacklist";

/// Stored in the ExtraAccountMetaList PDA. Links this hook to the
/// stablecoin config that owns the blacklist entries.
#[account]
#[derive(InitSpace)]
pub struct HookConfig {
    pub mint: Pubkey,
    pub stablecoin_config: Pubkey,
    pub bump: u8,
}
