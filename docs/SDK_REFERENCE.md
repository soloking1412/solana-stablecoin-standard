# SDK Reference

## Installation

```bash
yarn add @stbr/sss-token
```

## Core Classes

### SolanaStablecoin

Main entry point for interacting with SSS programs.

```typescript
import { SolanaStablecoin } from "@stbr/sss-token";
```

#### Static Methods

| Method | Description |
|--------|-------------|
| `SolanaStablecoin.create(connection, authority, params)` | Initialize a new stablecoin |

#### Instance Methods

| Method | Description |
|--------|-------------|
| `mint(amount, recipient)` | Mint tokens to a recipient |
| `burn(amount, tokenAccount)` | Burn tokens from an account |
| `freeze(tokenAccount)` | Freeze a token account |
| `thaw(tokenAccount)` | Unfreeze a token account |
| `pause()` | Pause all operations |
| `unpause()` | Resume operations |
| `grantRole(role, user)` | Assign a role to a user |
| `revokeRole(role, user)` | Remove a role from a user |
| `createMinterQuota(minter, quota)` | Set a minter's quota |
| `updateMinterQuota(minter, newQuota)` | Update a minter's quota |
| `blacklistAdd(address, reason)` | Add to blacklist (SSS-2+) |
| `blacklistRemove(address)` | Remove from blacklist (SSS-2+) |
| `seize(fromAccount, toAccount)` | Seize tokens (SSS-2+) |
| `transferAuthority(newAuthority)` | Transfer authority |

### RoleManager

Manages role assignments and queries.

```typescript
import { RoleManager } from "@stbr/sss-token";
```

| Method | Description |
|--------|-------------|
| `grantRole(role, user)` | Assign role |
| `revokeRole(role, user)` | Remove role |
| `hasRole(role, user)` | Check if user has active role |

### ComplianceManager

Handles compliance operations (SSS-2+).

```typescript
import { ComplianceManager } from "@stbr/sss-token";
```

| Method | Description |
|--------|-------------|
| `addToBlacklist(address, reason)` | Blacklist address |
| `removeFromBlacklist(address)` | Un-blacklist address |
| `isBlacklisted(address)` | Check blacklist status |
| `seize(from, to)` | Seize tokens |

### OracleHelper

Price feed integration utilities.

```typescript
import { OracleHelper } from "@stbr/sss-token";
```

| Method | Description |
|--------|-------------|
| `validatePrice(priceFeed, config)` | Validate a price feed |
| `calculateMintAmount(fiatAmount, price)` | Convert fiat to tokens |
| `calculateRedeemAmount(tokenAmount, price)` | Convert tokens to fiat |

### EventManager

Event subscription and parsing.

```typescript
import { EventManager } from "@stbr/sss-token";
```

| Method | Description |
|--------|-------------|
| `subscribe(eventType, callback)` | Listen for events |
| `parseEvent(log)` | Parse a log into a typed event |

## PDA Helpers

```typescript
import { getConfigAddress, getRoleAddress, getMinterQuotaAddress, getBlacklistAddress } from "@stbr/sss-token";

const configPda = getConfigAddress(mint, programId);
const rolePda = getRoleAddress(config, roleType, user, programId);
const quotaPda = getMinterQuotaAddress(config, minter, programId);
const blacklistPda = getBlacklistAddress(config, address, programId);
```

## Presets

```typescript
import { SSS_PRESETS } from "@stbr/sss-token";

// SSS_PRESETS[1] — Minimal
// SSS_PRESETS[2] — Compliant
// SSS_PRESETS[3] — Private
```

Each preset contains:

```typescript
interface PresetConfig {
  preset: number;
  permanentDelegate: boolean;
  transferHook: boolean;
  defaultAccountFrozen: boolean;
  roles: RoleType[];
}
```

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | Paused | Token operations are paused |
| 6001 | NotPaused | Token is not paused |
| 6002 | ZeroAmount | Amount must be greater than 0 |
| 6003 | QuotaExceeded | Minter quota exceeded |
| 6004 | Unauthorized | Caller lacks required role |
| 6005 | RoleInactive | Role has been revoked |
| 6006 | InvalidRole | Invalid role type |
| 6007 | ComplianceNotEnabled | Feature requires SSS-2+ |
| 6008 | AlreadyBlacklisted | Address already blacklisted |
| 6009 | NotBlacklisted | Address not on blacklist |
| 6010 | AddressBlacklisted | Transfer blocked by blacklist |
| 6011 | LastAdmin | Cannot remove last admin |
| 6012 | NameTooLong | Name exceeds 32 characters |
| 6013 | SymbolTooLong | Symbol exceeds 10 characters |
| 6014 | UriTooLong | URI exceeds 200 characters |
| 6015 | ReasonTooLong | Reason exceeds 128 characters |
| 6016 | InvalidPreset | Preset must be 1, 2, or 3 |
| 6017 | AccountAlreadyFrozen | Account is already frozen |
| 6018 | AccountNotFrozen | Account is not frozen |
| 6019 | Overflow | Arithmetic overflow |
| 6020 | AuthorityMismatch | Wrong authority |
| 6021 | MintMismatch | Mint does not match config |
| 6022 | ComplianceRoleNotAllowed | Compliance roles require SSS-2+ |
| 6023 | AccountMustBeFrozen | Seize requires frozen account |
| 6024 | InvalidAuthority | Invalid authority key |
| 6025 | InsufficientBalance | Not enough tokens |

## Events

| Event | Emitted When |
|-------|-------------|
| TokenInitialized | New stablecoin created |
| TokensMinted | Tokens minted |
| TokensBurned | Tokens burned |
| AccountFrozen | Token account frozen |
| AccountThawed | Token account thawed |
| TokenPaused | Operations paused |
| TokenUnpaused | Operations resumed |
| RoleGranted | Role assigned to user |
| RoleRevoked | Role removed from user |
| MinterQuotaUpdated | Quota created or updated |
| AuthorityTransferred | Authority changed |
| AddressBlacklisted | Address added to blacklist |
| AddressUnblacklisted | Address removed from blacklist |
| TokensSeized | Tokens seized from frozen account |

## TypeScript Types

```typescript
interface StablecoinConfig {
  authority: PublicKey;
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  preset: number;
  paused: boolean;
  totalMinted: BN;
  totalBurned: BN;
  enablePermanentDelegate: boolean;
  enableTransferHook: boolean;
  enableDefaultAccountFrozen: boolean;
  createdAt: BN;
  updatedAt: BN;
}

enum RoleType {
  Admin = 0,
  Minter = 1,
  Burner = 2,
  Freezer = 3,
  Pauser = 4,
  Blacklister = 5,
  Seizer = 6,
}
```
