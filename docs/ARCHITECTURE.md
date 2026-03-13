# Architecture

## Overview

The Solana Stablecoin Standard (SSS) is a modular framework for issuing regulated stablecoins on Solana using Token-2022. It follows a tiered preset system that allows issuers to select the compliance level appropriate for their use case.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interfaces                          │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌─────────────┐  │
│  │ React App│   │   TUI    │   │   CLI    │   │  Backend API│  │
│  │ (app/)   │   │  (tui/)  │   │ (sdk/cli)│   │ (backend/)  │  │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └──────┬──────┘  │
│       │              │              │                │          │
│       └──────────────┴──────┬───────┴────────────────┘          │
│                             │                                   │
│                    ┌────────┴────────┐                           │
│                    │   TypeScript    │                           │
│                    │   SDK (core)    │                           │
│                    └────────┬────────┘                           │
└─────────────────────────────┼───────────────────────────────────┘
                              │ RPC
┌─────────────────────────────┼───────────────────────────────────┐
│                     Solana Blockchain                            │
│                              │                                  │
│  ┌───────────────────────────┴──────────────────────────────┐   │
│  │                     sss-token                             │   │
│  │  ┌───────────┬───────────┬───────────┬──────────────┐    │   │
│  │  │initialize │ mint/burn │freeze/thaw│ pause/unpause│    │   │
│  │  ├───────────┼───────────┼───────────┼──────────────┤    │   │
│  │  │grant/     │ create/   │ blacklist │    seize     │    │   │
│  │  │revoke role│ update    │ add/remove│              │    │   │
│  │  │           │ quota     │ (SSS-2+)  │  (SSS-2+)   │    │   │
│  │  └───────────┴───────────┴───────────┴──────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               sss-transfer-hook (SSS-2 only)              │   │
│  │  ┌────────────────────────┐  ┌────────────────────────┐  │   │
│  │  │ initialize_extra_metas │  │ execute (blacklist chk) │  │   │
│  │  └────────────────────────┘  └────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────┐                                         │
│  │    Token-2022       │  Permanent Delegate · Transfer Hook    │
│  │    Extensions       │  Default Account State · Metadata      │
│  └────────────────────┘                                         │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     Rust Modules (off-chain)                      │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────┐        │
│  │sss-roles │    │  sss-oracle   │    │ sss-compliance  │        │
│  │ RBAC     │    │ Price feeds   │    │ Audit trails    │        │
│  │ logic    │    │ Conversions   │    │ Screening       │        │
│  └──────────┘    └──────────────┘    └─────────────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

## Presets

### SSS-1: Minimal Stablecoin

Best for: internal tokens, DAO treasuries, simple wrapped assets.

| Feature              | Enabled |
|----------------------|---------|
| Mint / Burn          | ✅      |
| Freeze / Thaw        | ✅      |
| Pause / Unpause      | ✅      |
| Role management      | ✅      |
| Permanent Delegate   | ❌      |
| Transfer Hook        | ❌      |
| Default Frozen       | ❌      |
| Blacklist            | ❌      |
| Seize                | ❌      |

### SSS-2: Compliant Stablecoin

Best for: regulated fiat-backed tokens (USDC/USDT-class).

| Feature              | Enabled |
|----------------------|---------|
| All SSS-1 features   | ✅      |
| Permanent Delegate   | ✅      |
| Transfer Hook        | ✅      |
| Default Frozen       | ✅      |
| Blacklist            | ✅      |
| Seize                | ✅      |

### SSS-3: Private Stablecoin (Experimental)

Best for: privacy-preserving compliant tokens.

| Feature              | Enabled |
|----------------------|---------|
| All SSS-2 features   | ✅      |
| Confidential Transfers| ✅     |
| Private audit trail  | ✅      |

## Account Structure

```
StablecoinConfig (PDA: ["stablecoin", mint])
├── authority: Pubkey
├── mint: Pubkey
├── name: String (max 32)
├── symbol: String (max 10)
├── uri: String (max 200)
├── decimals: u8
├── preset: u8 (1, 2, or 3)
├── paused: bool
├── total_minted: u64
├── total_burned: u64
├── enable_permanent_delegate: bool
├── enable_transfer_hook: bool
├── enable_default_account_frozen: bool
├── created_at: i64
├── updated_at: i64
└── reserved: [u8; 64]

RoleAccount (PDA: ["role", config, role_type, user])
├── config: Pubkey
├── user: Pubkey
├── role: u8
├── active: bool
├── granted_by: Pubkey
└── granted_at: i64

MinterQuota (PDA: ["minter", config, minter])
├── config: Pubkey
├── minter: Pubkey
├── quota: u64
└── minted: u64

BlacklistEntry (PDA: ["blacklist", config, address])
├── config: Pubkey
├── address: Pubkey
├── reason: String (max 128)
├── blacklisted_by: Pubkey
└── blacklisted_at: i64
```

## Role-Based Access Control

| Role (ID) | Permissions                               |
|------------|------------------------------------------|
| Admin (0)  | Manage roles, transfer authority, quotas |
| Minter (1) | Mint tokens (within quota)               |
| Burner (2) | Burn tokens from any account             |
| Freezer (3)| Freeze / thaw token accounts             |
| Pauser (4) | Pause / unpause all operations           |
| Blacklister (5) | Add / remove blacklist entries (SSS-2+) |
| Seizer (6) | Seize tokens from frozen accounts (SSS-2+) |

## Transfer Hook Flow (SSS-2)

```
User Transfer → Token-2022 Program
                    │
                    ▼
            sss-transfer-hook::execute()
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  Check Source              Check Destination
  Blacklist PDA             Blacklist PDA
        │                       │
  ┌─────┴─────┐          ┌─────┴─────┐
  │Exists?    │          │Exists?    │
  │Yes → FAIL │          │Yes → FAIL │
  │No  → OK   │          │No  → OK   │
  └───────────┘          └───────────┘
        │                       │
        └───────────┬───────────┘
                    ▼
              Transfer OK
```

## Security Model

- **Fail-closed design**: Missing blacklist PDAs = not blacklisted (safe default)
- **Overflow protection**: All arithmetic uses checked operations
- **Last admin protection**: Cannot revoke the sole admin role
- **Pause gating**: Mint/burn operations are blocked when paused
- **Quota enforcement**: Minters cannot exceed their allocated quota
- **PDA-based authorization**: All state accounts derived deterministically
- **Event audit trail**: Every action emits an event for off-chain indexing
