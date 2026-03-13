# SSS-1: Minimal Stablecoin Standard

## Overview

SSS-1 is the foundational tier of the Solana Stablecoin Standard. It provides the minimum viable feature set for issuing a managed token on Solana using Token-2022, with role-based access control, minter quotas, and lifecycle management.

**Best for:** Internal tokens, DAO treasuries, simple wrapped assets, community tokens, and prototyping.

## Feature Matrix

| Feature | Status | Description |
|---------|--------|-------------|
| Token-2022 Mint | ✅ | SPL Token-2022 with metadata extension |
| Mint / Burn | ✅ | Controlled supply with minter quotas |
| Freeze / Thaw | ✅ | Account-level freeze via Token-2022 freeze authority |
| Pause / Unpause | ✅ | Global circuit-breaker for all operations |
| Role-Based Access | ✅ | 5 roles: Admin, Minter, Burner, Freezer, Pauser |
| Minter Quotas | ✅ | Per-minter supply limits with overflow protection |
| Authority Transfer | ✅ | Ownership transfer with single-step execution |
| Event Audit Trail | ✅ | 10 event types for off-chain indexing |
| Permanent Delegate | ❌ | Not available in SSS-1 |
| Transfer Hook | ❌ | Not available in SSS-1 |
| Blacklist | ❌ | Not available in SSS-1 |
| Seize | ❌ | Not available in SSS-1 |

## Architecture

```
                    ┌──────────────────────────────────┐
                    │          sss-token program         │
                    │                                    │
                    │  ┌────────────┐  ┌──────────────┐ │
                    │  │ initialize │  │  mint_tokens  │ │
                    │  ├────────────┤  ├──────────────┤ │
                    │  │burn_tokens │  │freeze_account│ │
                    │  ├────────────┤  ├──────────────┤ │
                    │  │thaw_account│  │    pause     │ │
                    │  ├────────────┤  ├──────────────┤ │
                    │  │  unpause   │  │ grant_role   │ │
                    │  ├────────────┤  ├──────────────┤ │
                    │  │revoke_role │  │create_quota  │ │
                    │  ├────────────┤  ├──────────────┤ │
                    │  │update_quota│  │transfer_auth │ │
                    │  └────────────┘  └──────────────┘ │
                    └──────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │        Token-2022 Mint         │
                    │  Mint Authority: Config PDA    │
                    │  Freeze Authority: Config PDA  │
                    │  Metadata: On-chain            │
                    └───────────────────────────────┘
```

## Account Structure

### StablecoinConfig PDA

Seeds: `["stablecoin", mint.key()]`

```rust
pub struct StablecoinConfig {
    pub authority: Pubkey,       // Admin authority
    pub mint: Pubkey,            // Token-2022 mint
    pub name: String,            // Max 32 chars
    pub symbol: String,          // Max 10 chars
    pub uri: String,             // Max 200 chars
    pub decimals: u8,            // Token decimals
    pub preset: u8,              // Always 1 for SSS-1
    pub paused: bool,            // Global pause state
    pub total_minted: u64,       // Cumulative minted
    pub total_burned: u64,       // Cumulative burned
    pub enable_permanent_delegate: bool,  // false for SSS-1
    pub enable_transfer_hook: bool,       // false for SSS-1
    pub default_account_frozen: bool,     // false for SSS-1
    pub created_at: i64,
    pub bump: u8,
    pub _reserved: [u8; 64],     // Forward compatibility
}
```

### RoleAccount PDA

Seeds: `["role", config.key(), role_type, user.key()]`

```rust
pub struct RoleAccount {
    pub config: Pubkey,
    pub user: Pubkey,
    pub role: u8,           // 0=Admin, 1=Minter, 2=Burner, 3=Freezer, 4=Pauser
    pub active: bool,
    pub granted_by: Pubkey,
    pub granted_at: i64,
    pub bump: u8,
}
```

### MinterQuota PDA

Seeds: `["minter", config.key(), minter.key()]`

```rust
pub struct MinterQuota {
    pub config: Pubkey,
    pub minter: Pubkey,
    pub quota: u64,          // Maximum allowed minted amount
    pub minted: u64,         // Amount already minted
    pub bump: u8,
}
```

## Roles (SSS-1)

| Role | ID | Permissions |
|------|----|-------------|
| Admin | 0 | Grant/revoke roles, create/update quotas, transfer authority |
| Minter | 1 | Mint tokens within assigned quota |
| Burner | 2 | Burn tokens from any token account |
| Freezer | 3 | Freeze / thaw individual token accounts |
| Pauser | 4 | Pause / unpause all operations globally |

> **Note:** Blacklister (5) and Seizer (6) roles are rejected on SSS-1. Attempting to grant these roles returns `ComplianceRoleNotAllowed`.

## Initialization

### CLI

```bash
sss-token init --name "My USD" --symbol MUSD --decimals 6 --preset sss-1
```

### SDK

```typescript
import { SolanaStablecoin, Preset } from "@stbr/sss-token";

const stablecoin = await SolanaStablecoin.create(connection, {
  name: "My USD",
  symbol: "MUSD",
  decimals: 6,
  preset: Preset.SSS_1,
  authority: keypair,
});
```

### Config File

```json
{
  "name": "My USD",
  "symbol": "MUSD",
  "decimals": 6,
  "preset": 1,
  "uri": "https://example.com/metadata.json"
}
```

```bash
sss-token init --config ./config.json
```

## Operations

### Mint Tokens

Requires: `Minter` role + active quota with remaining capacity.

```typescript
await stablecoin.mint({
  amount: 1_000_000,       // 1.0 MUSD (6 decimals)
  recipient: tokenAccount,
  minter: minterKeypair,
});
```

**Checks:**
1. Token must not be paused
2. Minter must have active Minter role
3. Amount must be > 0
4. `quota.minted + amount <= quota.quota` (overflow-safe)

### Burn Tokens

Requires: `Burner` role.

```typescript
await stablecoin.burn({
  amount: 500_000,
  tokenAccount: tokenAccount,
  burner: burnerKeypair,
});
```

### Freeze / Thaw

Requires: `Freezer` role.

```typescript
await stablecoin.freeze(tokenAccount, freezerKeypair);
await stablecoin.thaw(tokenAccount, freezerKeypair);
```

### Pause / Unpause

Requires: `Pauser` role.

```typescript
await stablecoin.pause(pauserKeypair);
await stablecoin.unpause(pauserKeypair);
```

## Events

| Event | Fields | Emitted When |
|-------|--------|-------------|
| `TokenInitialized` | mint, authority, name, symbol, decimals, preset | New stablecoin created |
| `TokensMinted` | mint, recipient, amount, minter, total_minted | Tokens minted |
| `TokensBurned` | mint, from, amount, burner, total_burned | Tokens burned |
| `AccountFrozen` | mint, account, frozen_by | Token account frozen |
| `AccountThawed` | mint, account, thawed_by | Token account thawed |
| `TokenPaused` | mint, paused_by | Operations paused |
| `TokenUnpaused` | mint, unpaused_by | Operations resumed |
| `RoleGranted` | config, user, role, granted_by | Role assigned |
| `RoleRevoked` | config, user, role, revoked_by | Role removed |
| `MinterQuotaUpdated` | config, minter, new_quota, updated_by | Quota changed |

## Security Guarantees

1. **Last admin protection:** Cannot revoke the sole Admin role
2. **Overflow-safe arithmetic:** All calculations use `checked_add`, `checked_sub`
3. **PDA isolation:** Each role, quota, and config has a unique deterministic address
4. **Pause gating:** Mint and burn are blocked when the token is paused
5. **Quota enforcement:** Minters cannot exceed their allocated quota
6. **Reserved space:** 64-byte `_reserved` field for forward-compatible upgrades

## Upgrade Path

SSS-1 tokens can be conceptually "upgraded" by deploying a new SSS-2 token and migrating holders. The on-chain preset value is immutable after initialization to prevent unauthorized compliance downgrades.

## Test Coverage

SSS-1 is tested with **28 integration tests** covering:
- Initialization (valid, invalid preset, name too long)
- Role management (grant, revoke, compliance gating, non-admin rejection)
- Minter quotas (create, enforce limits)
- Mint operations (success, zero amount, quota exceeded, while paused)
- Burn operations (success, zero amount)
- Freeze/thaw (success, double-freeze, thaw non-frozen)
- Pause/unpause (success, double-pause, mint-while-paused)
- Authority transfer (full round-trip)
