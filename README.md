# Solana Stablecoin Standard (SSS)

A modular, production-ready framework for issuing regulated stablecoins on Solana using Token-2022. Built with Anchor 0.31.1, three tiered presets, role-based access control, on-chain compliance enforcement, and a full-stack toolchain.

## Program IDs

| Program | Address |
|---------|---------|
| **sss-token** | `StbMVdQRUykc9jS3bT1LCiHBqBos1awkVHFn2cFRLwR` |
| **sss-transfer-hook** | `SThk8WNt3JUYTCNwUgMJeLSBbqRbGnFv6xFM4th7giQ` |

## Architecture

```
                         ┌──────────────────────────┐
                         │     User Interfaces       │
          ┌──────────────┼──────────────────────────┼──────────────┐
          │              │                          │              │
    ┌─────┴─────┐  ┌─────┴─────┐  ┌────────┐  ┌───┴──────┐
    │ React App │  │    TUI    │  │  CLI   │  │ Backend  │
    │  (app/)   │  │   (tui/)  │  │(sdk/cli)│  │(backend/)│
    └─────┬─────┘  └─────┬─────┘  └────┬───┘  └───┬──────┘
          └───────────────┴─────────────┴──────────┘
                              │
                    ┌─────────┴─────────┐
                    │   TypeScript SDK   │
                    │   (@stbr/sss-token)│
                    └─────────┬─────────┘
                              │ RPC
          ┌───────────────────┼───────────────────────┐
          │           Solana Blockchain                │
          │                                           │
          │  ┌─────────────────────────────────────┐  │
          │  │           sss-token                  │  │
          │  │  init · mint · burn · freeze · thaw  │  │
          │  │  pause · roles · quotas · blacklist  │  │
          │  │  seize · transfer_authority          │  │
          │  └─────────────┬───────────────────────┘  │
          │                │                          │
          │  ┌─────────────┴───────────────────────┐  │
          │  │     sss-transfer-hook (SSS-2)        │  │
          │  │  Blacklist enforcement on transfer    │  │
          │  └─────────────────────────────────────┘  │
          │                                           │
          │  ┌─────────────────────────────────────┐  │
          │  │         Token-2022 Extensions        │  │
          │  │  Permanent Delegate · Transfer Hook  │  │
          │  │  Default Account State · Metadata    │  │
          │  └─────────────────────────────────────┘  │
          └───────────────────────────────────────────┘
```

## Presets

| Feature | SSS-1 (Minimal) | SSS-2 (Compliant) | SSS-3 (Private) |
|---------|:---:|:---:|:---:|
| Mint / Burn with quotas | Yes | Yes | Yes |
| Freeze / Thaw | Yes | Yes | Yes |
| Pause / Unpause | Yes | Yes | Yes |
| Role-based access (7 roles) | Yes | Yes | Yes |
| Permanent Delegate | - | Yes | Yes |
| Transfer Hook (blacklist) | - | Yes | Yes |
| Default Account Frozen | - | Yes | Yes |
| Blacklist management | - | Yes | Yes |
| Seize (compliance seizure) | - | Yes | Yes |
| Confidential Transfers | - | - | Yes |

**SSS-1** is ideal for internal tokens, DAO treasuries, and simple wrapped assets.
**SSS-2** is designed for regulated fiat-backed tokens (USDC/USDT-class).
**SSS-3** extends SSS-2 with privacy-preserving features for experimental use cases.

## Quick Start

```bash
# Clone and setup
git clone https://github.com/solanabr/solana-stablecoin-standard.git
cd solana-stablecoin-standard

# Automated setup
./scripts/setup.sh

# Or manually:
yarn install
anchor build
anchor test
```

## Project Structure

```
solana-stablecoin-standard/
├── programs/
│   ├── sss-token/               # Core stablecoin program (15 instructions)
│   │   └── src/
│   │       ├── lib.rs           # Program entry + instruction routing
│   │       ├── state.rs         # 4 account types (Config, Role, Quota, Blacklist)
│   │       ├── error.rs         # 26 error codes
│   │       ├── events.rs        # 14 event types for audit trail
│   │       ├── constants.rs     # Seeds, limits, presets
│   │       └── instructions/    # 15 instruction handlers
│   └── sss-transfer-hook/       # Token-2022 transfer hook for blacklists
│       └── src/
│           ├── lib.rs           # Hook routing + fallback handler
│           ├── state.rs         # Hook configuration
│           ├── error.rs         # Transfer hook errors
│           └── instructions/    # Initialize metas + execute
│
├── modules/                     # Reusable Rust libraries (off-chain)
│   ├── sss-roles/               # RBAC logic + permissions (20 tests)
│   ├── sss-oracle/              # Price feed validation (19 tests)
│   └── sss-compliance/          # Compliance framework (16 tests)
│
├── sdk/core/                    # TypeScript SDK + CLI
│   ├── src/
│   │   ├── stablecoin.ts        # Main SolanaStablecoin class
│   │   ├── presets.ts           # SSS-1/SSS-2/SSS-3 configurations
│   │   ├── pda.ts               # PDA derivation helpers
│   │   ├── compliance.ts        # Compliance operations
│   │   ├── oracle.ts            # Oracle integration
│   │   └── cli/                 # CLI commands
│   └── __tests__/               # 5 test suites
│
├── app/                         # React + Tailwind web dashboard
├── backend/                     # Express.js API + indexer + webhooks
├── tui/                         # Rust terminal dashboard (Ratatui)
├── tests/                       # Anchor integration tests
│   ├── sss-1.ts                 # SSS-1 preset tests
│   └── sss-2.ts                 # SSS-2 preset tests
├── trident-tests/               # Trident fuzz tests
├── docs/                        # Architecture, SDK reference, getting started
├── scripts/                     # Setup + deployment scripts
└── .github/workflows/           # CI/CD pipelines
```

## On-Chain Program

### Instructions (15 total)

| Instruction | Role Required | SSS-1 | SSS-2 |
|-------------|--------------|:-----:|:-----:|
| `initialize` | Authority | Yes | Yes |
| `mint_tokens` | Minter | Yes | Yes |
| `burn_tokens` | Burner | Yes | Yes |
| `freeze_account` | Freezer | Yes | Yes |
| `thaw_account` | Freezer | Yes | Yes |
| `pause` | Pauser | Yes | Yes |
| `unpause` | Pauser | Yes | Yes |
| `grant_role` | Admin | Yes | Yes |
| `revoke_role` | Admin | Yes | Yes |
| `create_minter_quota` | Admin | Yes | Yes |
| `update_minter_quota` | Admin | Yes | Yes |
| `transfer_authority` | Authority | Yes | Yes |
| `blacklist_add` | Blacklister | - | Yes |
| `blacklist_remove` | Blacklister | - | Yes |
| `seize` | Seizer | - | Yes |

### Role-Based Access Control (7 Roles)

| Role (ID) | Permissions |
|-----------|-------------|
| Admin (0) | Manage roles, transfer authority, manage quotas |
| Minter (1) | Mint tokens within quota |
| Burner (2) | Burn tokens from any account |
| Freezer (3) | Freeze / thaw token accounts |
| Pauser (4) | Pause / unpause all operations |
| Blacklister (5) | Manage blacklist entries (SSS-2+ only) |
| Seizer (6) | Seize tokens from frozen accounts (SSS-2+ only) |

### Security Features

- **Fail-closed transfer hook** — missing blacklist PDA = not blacklisted (safe default)
- **Overflow-protected arithmetic** — all calculations use checked operations
- **Last admin protection** — cannot revoke the sole admin role
- **Pause gating** — mint/burn blocked when paused
- **Quota enforcement** — per-minter limits with overflow-safe tracking
- **PDA-based authorization** — deterministic address derivation
- **Event audit trail** — every action emits an event for off-chain indexing
- **Reserved space** — 64-byte `_reserved` field for forward-compatible upgrades
- **Compliance role gating** — Blacklister/Seizer roles rejected on SSS-1

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | Paused | Operations are paused |
| 6001 | NotPaused | Token is not paused |
| 6002 | ZeroAmount | Amount must be > 0 |
| 6003 | QuotaExceeded | Minter quota exceeded |
| 6004 | Unauthorized | Missing required role |
| 6005 | RoleInactive | Role has been revoked |
| 6006 | InvalidRole | Invalid role type |
| 6007 | ComplianceNotEnabled | Feature requires SSS-2+ |
| 6008 | AlreadyBlacklisted | Already on blacklist |
| 6009 | NotBlacklisted | Not on blacklist |
| 6010 | AddressBlacklisted | Transfer blocked |
| 6011 | LastAdmin | Cannot remove last admin |
| 6016 | InvalidPreset | Must be 1, 2, or 3 |
| 6017 | AccountAlreadyFrozen | Already frozen |
| 6018 | AccountNotFrozen | Not frozen |
| 6019 | Overflow | Arithmetic overflow |
| 6023 | AccountMustBeFrozen | Seize requires frozen account |

## Transfer Hook (SSS-2)

The `sss-transfer-hook` program enforces blacklist checks at the Token-2022 transfer level:

```
User Transfer -> Token-2022 -> sss-transfer-hook::execute()
                                     |
                    ┌────────────────┴────────────────┐
                    v                                 v
              Check Source                     Check Destination
              Blacklist PDA                    Blacklist PDA
                    |                                 |
              ┌─────┴─────┐                    ┌─────┴─────┐
              │PDA exists? │                   │PDA exists? │
              │Yes -> FAIL │                   │Yes -> FAIL │
              │No  -> OK   │                   │No  -> OK   │
              └───────────┘                    └───────────┘
```

Uses `ExtraAccountMetaList` with `Seed::AccountKey` resolution to dynamically derive blacklist PDAs for both source and destination during transfer.

## Rust Modules

Three independently testable libraries with **55 unit tests** (plus 60+ fuzz invariant tests):

### sss-roles (20 tests)
- `RoleType` enum (7 roles) + permission model
- `role_has_permission()` — check if role can perform action
- `requires_compliance()` — roles needing SSS-2+
- `validate_role_assignment()` — only Admin can assign

### sss-oracle (19 tests)
- `PriceFeed` + `OracleConfig` structs
- `validate_price()` — staleness, confidence, exponent checks
- `calculate_mint_amount()` / `calculate_redeem_amount()` — fiat-to-token conversion
- Roundtrip-verified arithmetic

### sss-compliance (16 tests)
- `AuditAction` enum (13 actions) + `ComplianceLevel` (None/Basic/Full/Private)
- `is_compliant_action()` — check action at compliance level
- `requires_blacklist_check()` — blacklist needed?
- `format_audit_entry()` — human-readable formatting

## TypeScript SDK

```typescript
import { SolanaStablecoin } from "@stbr/sss-token";
import { Connection, Keypair } from "@solana/web3.js";

// Create a new SSS-1 stablecoin
const stablecoin = await SolanaStablecoin.create(connection, authority, {
  name: "My USD",
  symbol: "MUSD",
  decimals: 6,
  preset: 1,
});

// Mint tokens (requires Minter role + quota)
await stablecoin.mint(1_000_000, recipientTokenAccount);

// Burn tokens
await stablecoin.burn(500_000, tokenAccount);

// Role management
await stablecoin.grantRole(RoleType.Minter, userPubkey);
await stablecoin.revokeRole(RoleType.Minter, userPubkey);

// SSS-2 compliance operations
await stablecoin.blacklistAdd(suspiciousAddress, "Sanctions");
await stablecoin.seize(frozenTokenAccount, treasuryAccount);
```

### PDA Helpers

```typescript
import { getConfigAddress, getRoleAddress, getMinterQuotaAddress, getBlacklistAddress } from "@stbr/sss-token";

const config = getConfigAddress(mint, programId);
const role = getRoleAddress(config, RoleType.Minter, user, programId);
const quota = getMinterQuotaAddress(config, minter, programId);
const blacklist = getBlacklistAddress(config, address, programId);
```

## CLI

```bash
sss-token init --name "My USD" --symbol MUSD --decimals 6 --preset 1
sss-token mint --amount 1000 --to <RECIPIENT>
sss-token status
sss-token minters list
sss-token minters add --address <PUBKEY> --quota 1000000
sss-token blacklist add --address <PUBKEY> --reason "Sanctions"
sss-token freeze --account <TOKEN_ACCOUNT>
sss-token seize --from <TOKEN_ACCOUNT> --to <TREASURY>
```

## Testing

```bash
# Anchor integration tests (SSS-1 + SSS-2 full lifecycle)
anchor test

# Rust module unit tests (55 tests)
cargo test -p sss-roles --lib         # 20 tests
cargo test -p sss-oracle --lib        # 19 tests
cargo test -p sss-compliance --lib    # 16 tests

# SDK unit tests
yarn test:sdk

# Trident fuzz tests
cd trident-tests && trident fuzz run-hfuzz fuzz_0
```

### Integration Test Coverage

**SSS-1 Tests** — 28+ test cases covering:
- Initialization with validation (invalid preset, name too long)
- Role management (grant, revoke, compliance gating, non-admin rejection)
- Minter quotas (create, enforce)
- Mint operations (success, zero amount, quota exceeded, paused)
- Burn operations (success, zero amount)
- Freeze/thaw (success, double-freeze, thaw non-frozen)
- Pause/unpause (success, double-pause, mint-while-paused)
- Authority transfer

**SSS-1 Extended Tests** — 35+ additional test cases covering:
- Multi-minter quota independence (3 minters, independent limits)
- Quota boundary testing (exact, over, exhaustion)
- Quota update and re-minting
- Multi-recipient burn tracking
- Freeze/thaw multiple accounts
- Pause blocks all minters and burners
- Freeze/thaw and role management work during pause
- Validation edge cases (symbol too long, URI too long, preset 0/4)
- Role revocation prevents minting
- Supply invariant verification
- PDA determinism and isolation verification

**SSS-2 Tests** — 44+ test cases covering:
- SSS-2 initialization with compliance features
- Blacklister/Seizer role grants
- Blacklist add/remove
- Seize from frozen accounts
- Transfer hook integration

## Deployment

```bash
# Deploy to devnet
./scripts/deploy.sh devnet

# Deploy to mainnet (requires confirmation)
./scripts/deploy.sh mainnet-beta

# Deploy specific program
./scripts/deploy.sh devnet sss-token
```

## CI/CD

GitHub Actions workflows:
- **CI** (`ci.yml`) — Rust lint/format, module tests, Anchor build, integration tests, SDK tests, security audit
- **Deploy** (`deploy.yml`) — Manual deployment with network selection and confirmation gates

## User Interfaces

### Web Dashboard (React + Tailwind)
5-tab interface: Create Token, Dashboard, Mint/Burn, Compliance, Roles

```bash
cd app && yarn dev
```

### Terminal UI (Ratatui)
5-panel dashboard: Overview, Supply, Holders, Events, Compliance

```bash
cd tui && cargo run -- --mint <MINT_ADDRESS>
```

### Backend API (Express)
REST endpoints: mint/burn, compliance, status, webhooks, event indexing

```bash
cd backend && yarn dev
# or
docker compose up
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design, presets, accounts, security model |
| [Getting Started](docs/GETTING_STARTED.md) | Prerequisites, setup, common operations |
| [SDK Reference](docs/SDK_REFERENCE.md) | Full API docs, PDA helpers, error codes, events |
| [API Reference](docs/API.md) | On-chain instructions, SDK methods, REST endpoints |
| [SSS-1 Specification](docs/SSS-1.md) | Minimal stablecoin preset details |
| [SSS-2 Specification](docs/SSS-2.md) | Compliant stablecoin preset details |
| [Compliance Framework](docs/COMPLIANCE.md) | Compliance architecture, blacklist, seizure, audit |
| [Operations Guide](docs/OPERATIONS.md) | Day-to-day operations, runbooks, monitoring |
| [Deployment Guide](docs/DEPLOYMENT.md) | Devnet/mainnet deployment, Docker, verification |
| [Security Policy](SECURITY.md) | Vulnerability reporting, security measures |
| [Changelog](CHANGELOG.md) | Version history and changes |

## Example Configurations

Ready-to-use configuration files for initializing stablecoins:

```bash
# SSS-1 using JSON config
sss-token init --config examples/sss-1-config.json

# SSS-2 using TOML config
sss-token init --config examples/sss-2-config.toml

# SSS-3 using JSON config
sss-token init --config examples/sss-3-config.json
```

## Technology Stack

| Component | Technology |
|-----------|-----------|
| On-chain programs | Anchor 0.31.1 + SPL Token-2022 |
| Blockchain | Solana 2.1 |
| SDK | TypeScript + @coral-xyz/anchor |
| Web frontend | React 18 + Vite + Tailwind CSS |
| Terminal UI | Ratatui + Crossterm + Tokio |
| Backend API | Express.js + Pino |
| Testing | Mocha + Chai + Trident (fuzz) |
| CI/CD | GitHub Actions |

## License

MIT License - Copyright 2026 Superteam Brazil
