# API Reference

## Overview

The Solana Stablecoin Standard exposes three API surfaces:

1. **On-Chain Program Instructions** — Direct Anchor program calls
2. **TypeScript SDK** — Programmatic access via `@stbr/sss-token`
3. **REST Backend API** — HTTP endpoints via Express.js

## On-Chain Instructions

### initialize

Creates a new stablecoin with the specified configuration.

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| `authority` | Signer | Initial admin authority |
| `config` | PDA (init) | `["stablecoin", mint]` — Stablecoin config |
| `mint` | Token-2022 Mint | Pre-created Token-2022 mint |
| `admin_role` | PDA (init) | `["role", config, 0, authority]` — Admin role |
| `token_program` | Program | Token-2022 program |
| `system_program` | Program | System program |
| `rent` | Sysvar | Rent sysvar |

**Arguments:**
```rust
pub struct InitializeParams {
    pub name: String,      // Max 32 chars
    pub symbol: String,    // Max 10 chars
    pub uri: String,       // Max 200 chars
    pub decimals: u8,
    pub preset: u8,        // 1, 2, or 3
}
```

**Errors:** `InvalidPreset`, `NameTooLong`, `SymbolTooLong`, `UriTooLong`

---

### mint_tokens

Mints tokens to a recipient. Requires Minter role and sufficient quota.

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| `minter` | Signer | Minter role holder |
| `config` | PDA | Stablecoin config |
| `minter_role` | PDA | `["role", config, 1, minter]` |
| `minter_quota` | PDA | `["minter", config, minter]` |
| `mint` | Token-2022 Mint | Stablecoin mint |
| `recipient_token_account` | Token Account | Destination |
| `token_program` | Program | Token-2022 program |

**Arguments:** `amount: u64`

**Errors:** `Paused`, `Unauthorized`, `RoleInactive`, `ZeroAmount`, `QuotaExceeded`, `Overflow`

---

### burn_tokens

Burns tokens from a token account. Requires Burner role.

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| `burner` | Signer | Burner role holder |
| `config` | PDA | Stablecoin config |
| `burner_role` | PDA | `["role", config, 2, burner]` |
| `mint` | Token-2022 Mint | Stablecoin mint |
| `token_account` | Token Account | Source to burn from |
| `token_program` | Program | Token-2022 program |

**Arguments:** `amount: u64`

**Errors:** `Paused`, `Unauthorized`, `RoleInactive`, `ZeroAmount`, `InsufficientBalance`

---

### freeze_account

Freezes a token account, preventing transfers.

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| `freezer` | Signer | Freezer role holder |
| `config` | PDA | Stablecoin config |
| `freezer_role` | PDA | `["role", config, 3, freezer]` |
| `mint` | Token-2022 Mint | Stablecoin mint |
| `token_account` | Token Account | Account to freeze |
| `token_program` | Program | Token-2022 program |

**Errors:** `Unauthorized`, `RoleInactive`, `AccountAlreadyFrozen`

---

### thaw_account

Unfreezes a frozen token account.

**Accounts:** Same as `freeze_account`

**Errors:** `Unauthorized`, `RoleInactive`, `AccountNotFrozen`

---

### pause

Pauses all mint and burn operations globally.

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| `pauser` | Signer | Pauser role holder |
| `config` | PDA (mut) | Stablecoin config |
| `pauser_role` | PDA | `["role", config, 4, pauser]` |

**Errors:** `Unauthorized`, `RoleInactive`, `Paused` (already paused)

---

### unpause

Resumes operations after a pause.

**Accounts:** Same as `pause`

**Errors:** `Unauthorized`, `RoleInactive`, `NotPaused`

---

### grant_role

Assigns a role to a user. Requires Admin role.

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| `admin` | Signer | Admin role holder |
| `config` | PDA | Stablecoin config |
| `admin_role` | PDA | `["role", config, 0, admin]` |
| `user` | Pubkey | User to receive role |
| `role_account` | PDA (init) | `["role", config, role_type, user]` |
| `system_program` | Program | System program |

**Arguments:** `role_type: u8` (0-6)

**Errors:** `Unauthorized`, `RoleInactive`, `InvalidRole`, `ComplianceRoleNotAllowed`

---

### revoke_role

Removes a role from a user.

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| `admin` | Signer | Admin role holder |
| `config` | PDA | Stablecoin config |
| `admin_role` | PDA | `["role", config, 0, admin]` |
| `user` | Pubkey | User to lose role |
| `role_account` | PDA (mut) | `["role", config, role_type, user]` |

**Arguments:** `role_type: u8`

**Errors:** `Unauthorized`, `RoleInactive`, `InvalidRole`, `LastAdmin`

---

### create_minter_quota

Creates a minting quota for a minter.

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| `admin` | Signer | Admin role holder |
| `config` | PDA | Stablecoin config |
| `admin_role` | PDA | `["role", config, 0, admin]` |
| `minter` | Pubkey | Minter to receive quota |
| `minter_quota` | PDA (init) | `["minter", config, minter]` |
| `system_program` | Program | System program |

**Arguments:** `quota: u64`

---

### update_minter_quota

Updates an existing minting quota.

**Accounts:** Similar to `create_minter_quota` (minter_quota is mut, not init)

**Arguments:** `new_quota: u64`

---

### transfer_authority

Transfers the admin authority to a new public key.

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| `authority` | Signer | Current authority |
| `config` | PDA (mut) | Stablecoin config |
| `new_authority` | Pubkey | New authority |

**Errors:** `AuthorityMismatch`

---

### blacklist_add (SSS-2+)

Adds an address to the blacklist.

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| `blacklister` | Signer | Blacklister role holder |
| `config` | PDA | Stablecoin config |
| `blacklister_role` | PDA | `["role", config, 5, blacklister]` |
| `blacklist_entry` | PDA (init) | `["blacklist", config, address]` |
| `address` | Pubkey | Address to blacklist |
| `system_program` | Program | System program |

**Arguments:** `reason: String` (max 128 chars)

**Errors:** `ComplianceNotEnabled`, `Unauthorized`, `AlreadyBlacklisted`, `ReasonTooLong`

---

### blacklist_remove (SSS-2+)

Removes an address from the blacklist.

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| `blacklister` | Signer | Blacklister role holder |
| `config` | PDA | Stablecoin config |
| `blacklister_role` | PDA | `["role", config, 5, blacklister]` |
| `blacklist_entry` | PDA (close) | `["blacklist", config, address]` |
| `address` | Pubkey | Address to un-blacklist |

**Errors:** `ComplianceNotEnabled`, `Unauthorized`, `NotBlacklisted`

---

### seize (SSS-2+)

Seizes tokens from a frozen account using the Permanent Delegate.

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| `seizer` | Signer | Seizer role holder |
| `config` | PDA | Stablecoin config |
| `seizer_role` | PDA | `["role", config, 6, seizer]` |
| `from_token_account` | Token Account | Frozen source |
| `to_token_account` | Token Account | Treasury destination |
| `mint` | Token-2022 Mint | Stablecoin mint |
| `token_program` | Program | Token-2022 program |

**Errors:** `ComplianceNotEnabled`, `Unauthorized`, `AccountMustBeFrozen`

---

## Transfer Hook Instructions

### initialize_extra_account_metas

Initializes the ExtraAccountMetaList for the transfer hook.

**Called during:** SSS-2 token initialization

### execute

Executes blacklist checks during Token-2022 transfers.

**Called by:** Token-2022 program during `transfer_checked`

**Logic:** Checks both source and destination for blacklist PDAs

---

## TypeScript SDK

### SolanaStablecoin

```typescript
import { SolanaStablecoin } from "@stbr/sss-token";

// Create new stablecoin
const stablecoin = await SolanaStablecoin.create(connection, {
  name: "My USD",
  symbol: "MUSD",
  decimals: 6,
  preset: Preset.SSS_1,
  authority: keypair,
});

// Load existing stablecoin
const existing = await SolanaStablecoin.load(connection, mintPubkey);
```

#### Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `create` | `connection, params` | `SolanaStablecoin` | Initialize new token |
| `load` | `connection, mint, authority?` | `SolanaStablecoin` | Load existing token |
| `getConfig` | — | `StablecoinConfig` | Fetch config |
| `refreshConfig` | — | `StablecoinConfig` | Force refresh config |
| `mint` | `{amount, recipient, minter}` | `string` (txid) | Mint tokens |
| `burn` | `{amount, tokenAccount, burner}` | `string` (txid) | Burn tokens |
| `freeze` | `tokenAccount, freezer` | `string` (txid) | Freeze account |
| `thaw` | `tokenAccount, freezer` | `string` (txid) | Thaw account |
| `pause` | `pauser` | `string` (txid) | Pause operations |
| `unpause` | `pauser` | `string` (txid) | Resume operations |
| `transferAuthority` | `newAuth, currentAuth` | `string` (txid) | Transfer authority |
| `getTotalSupply` | — | `{minted, burned, circulating}` | Supply info |
| `getHolders` | `{minBalance?}` | `HolderInfo[]` | List holders |
| `onMint` | `callback` | `() => void` | Subscribe to mints |
| `onBurn` | `callback` | `() => void` | Subscribe to burns |
| `onBlacklistChange` | `callback` | `() => void` | Subscribe to blacklist |
| `destroy` | — | `void` | Cleanup |

### ComplianceManager

```typescript
stablecoin.compliance.addToBlacklist(address, reason, signer);
stablecoin.compliance.removeFromBlacklist(address, signer);
stablecoin.compliance.isBlacklisted(address);
stablecoin.compliance.seize(from, to, signer);
```

### RoleManager

```typescript
stablecoin.roles.grantRole(role, user, admin);
stablecoin.roles.revokeRole(role, user, admin);
stablecoin.roles.hasRole(role, user);
```

### PDA Helpers

```typescript
import {
  getConfigAddress,
  getRoleAddress,
  getMinterQuotaAddress,
  getBlacklistAddress,
} from "@stbr/sss-token";

const [config, bump] = getConfigAddress(mint, programId);
const [role, bump] = getRoleAddress(config, roleType, user, programId);
const [quota, bump] = getMinterQuotaAddress(config, minter, programId);
const [bl, bump] = getBlacklistAddress(config, address, programId);
```

---

## REST Backend API

Base URL: `http://localhost:3000/api`

### Health Check

```
GET /health
```

Response: `200 OK`
```json
{ "status": "ok", "uptime": 12345 }
```

### Token Status

```
GET /api/status/:mintAddress
```

Response:
```json
{
  "mint": "...",
  "name": "My USD",
  "symbol": "MUSD",
  "decimals": 6,
  "preset": 1,
  "paused": false,
  "totalMinted": "10000000",
  "totalBurned": "1500000",
  "circulating": "8500000"
}
```

### Mint Tokens

```
POST /api/mint
Content-Type: application/json
Authorization: Bearer <API_KEY>
```

Body:
```json
{
  "amount": 1000000,
  "recipient": "<TOKEN_ACCOUNT_ADDRESS>",
  "mint": "<MINT_ADDRESS>"
}
```

### Compliance

#### Add to Blacklist

```
POST /api/compliance/blacklist
Authorization: Bearer <API_KEY>
```

Body:
```json
{
  "address": "<ADDRESS>",
  "reason": "OFAC SDN match",
  "mint": "<MINT_ADDRESS>"
}
```

#### Check Blacklist Status

```
GET /api/compliance/blacklist/:address?mint=<MINT_ADDRESS>
```

Response:
```json
{
  "address": "...",
  "blacklisted": true,
  "reason": "OFAC SDN match",
  "blacklistedAt": "2024-03-15T10:30:00Z",
  "blacklistedBy": "..."
}
```

#### Audit Log

```
GET /api/compliance/audit-log?mint=<MINT>&limit=50&action=mint
```

Response:
```json
{
  "entries": [
    {
      "signature": "...",
      "action": "mint",
      "timestamp": "2024-03-15T10:30:00Z",
      "status": "success",
      "details": { ... }
    }
  ]
}
```

### Webhooks

#### Register Webhook

```
POST /api/webhooks
Authorization: Bearer <API_KEY>
```

Body:
```json
{
  "url": "https://your-server.com/webhook",
  "events": ["mint", "burn", "blacklist_add", "seize"],
  "secret": "your-webhook-secret"
}
```

#### Webhook Payload

```json
{
  "event": "blacklist_add",
  "timestamp": "2024-03-15T10:30:00Z",
  "data": {
    "address": "...",
    "reason": "OFAC SDN match",
    "blacklistedBy": "..."
  },
  "signature": "hmac-sha256-signature"
}
```

---

## Error Codes Reference

| Code | Name | HTTP Status | Description |
|------|------|-------------|-------------|
| 6000 | Paused | 409 | Token operations are paused |
| 6001 | NotPaused | 409 | Token is not paused |
| 6002 | ZeroAmount | 400 | Amount must be > 0 |
| 6003 | QuotaExceeded | 403 | Minter quota exceeded |
| 6004 | Unauthorized | 403 | Caller lacks required role |
| 6005 | RoleInactive | 403 | Role has been revoked |
| 6006 | InvalidRole | 400 | Invalid role type |
| 6007 | ComplianceNotEnabled | 403 | Feature requires SSS-2+ |
| 6008 | AlreadyBlacklisted | 409 | Address already blacklisted |
| 6009 | NotBlacklisted | 404 | Address not on blacklist |
| 6010 | AddressBlacklisted | 403 | Transfer blocked by blacklist |
| 6011 | LastAdmin | 403 | Cannot remove last admin |
| 6012 | NameTooLong | 400 | Name exceeds 32 characters |
| 6013 | SymbolTooLong | 400 | Symbol exceeds 10 characters |
| 6014 | UriTooLong | 400 | URI exceeds 200 characters |
| 6015 | ReasonTooLong | 400 | Reason exceeds 128 characters |
| 6016 | InvalidPreset | 400 | Preset must be 1, 2, or 3 |
| 6017 | AccountAlreadyFrozen | 409 | Account is already frozen |
| 6018 | AccountNotFrozen | 409 | Account is not frozen |
| 6019 | Overflow | 500 | Arithmetic overflow |
| 6020 | AuthorityMismatch | 403 | Wrong authority |
| 6021 | MintMismatch | 400 | Mint does not match config |
| 6022 | ComplianceRoleNotAllowed | 403 | Compliance roles require SSS-2+ |
| 6023 | AccountMustBeFrozen | 400 | Seize requires frozen account |
| 6024 | InvalidAuthority | 403 | Invalid authority key |
| 6025 | InsufficientBalance | 400 | Not enough tokens |
