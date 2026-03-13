use anyhow::Result;
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;

use crate::app::{TokenInfo, HolderInfo, EventEntry};

pub fn fetch_config(client: &RpcClient, mint: &str) -> Result<TokenInfo> {
    // Derive the config PDA
    let mint_pubkey = Pubkey::from_str(mint)?;
    let (config_pda, _) = Pubkey::find_program_address(
        &[b"stablecoin", mint_pubkey.as_ref()],
        &Pubkey::from_str("StbMVdQRUykc9jS3bT1LCiHBqBos1awkVHFn2cFRLwR")?,
    );

    let account = client.get_account(&config_pda)?;
    let data = &account.data;

    // Skip 8-byte discriminator, then parse fields
    // This is a simplified parser — production would use borsh/anchor
    if data.len() < 100 {
        return Ok(placeholder_info());
    }

    // For now, return placeholder data — actual parsing depends on IDL
    Ok(placeholder_info())
}

pub fn fetch_holders(client: &RpcClient, mint: &str) -> Result<Vec<HolderInfo>> {
    let mint_pubkey = Pubkey::from_str(mint)?;

    let accounts = client.get_token_largest_accounts(&mint_pubkey)?;
    let holders: Vec<HolderInfo> = accounts
        .iter()
        .take(20)
        .map(|acc| HolderInfo {
            address: acc.address.to_string(),
            balance: acc.amount.amount.parse().unwrap_or(0),
            frozen: false,
        })
        .collect();

    Ok(holders)
}

pub fn fetch_recent_events(client: &RpcClient, program_id: &str) -> Result<Vec<EventEntry>> {
    let pubkey = Pubkey::from_str(program_id)?;
    let sigs = client.get_signatures_for_address(&pubkey)?;

    let events: Vec<EventEntry> = sigs
        .iter()
        .take(50)
        .map(|sig| EventEntry {
            event_type: if sig.err.is_some() { "Failed".into() } else { "Transaction".into() },
            actor: sig.signature[..8].to_string(),
            details: sig.memo.clone().unwrap_or_default(),
            timestamp: sig.block_time
                .map(|t| chrono::DateTime::from_timestamp(t, 0)
                    .map_or("unknown".into(), |dt| dt.format("%Y-%m-%d %H:%M:%S").to_string()))
                .unwrap_or_else(|| "unknown".into()),
        })
        .collect();

    Ok(events)
}

fn placeholder_info() -> TokenInfo {
    TokenInfo {
        name: "Loading...".into(),
        symbol: "...".into(),
        preset: 0,
        authority: "...".into(),
        paused: false,
        total_minted: 0,
        total_burned: 0,
        decimals: 6,
    }
}
