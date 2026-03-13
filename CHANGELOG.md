# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-13

### Added

#### On-Chain Programs
- **sss-token**: Core stablecoin program with 15 instructions
  - `initialize` — Create new stablecoin with preset configuration
  - `mint_tokens` / `burn_tokens` — Supply management with quota enforcement
  - `freeze_account` / `thaw_account` — Account-level freeze control
  - `pause` / `unpause` — Global circuit breaker
  - `grant_role` / `revoke_role` — 7-role RBAC system
  - `create_minter_quota` / `update_minter_quota` — Per-minter limits
  - `transfer_authority` — Ownership transfer
  - `blacklist_add` / `blacklist_remove` — Sanctions enforcement (SSS-2)
  - `seize` — Token seizure from frozen accounts (SSS-2)
- **sss-transfer-hook**: Token-2022 transfer hook for blacklist enforcement
  - `initialize_extra_account_metas` — Set up ExtraAccountMetaList
  - `execute` — Blacklist check on every transfer

#### Preset System
- **SSS-1 (Minimal)**: Basic mint/burn, freeze/thaw, pause, 5 roles
- **SSS-2 (Compliant)**: Full compliance with blacklist, seizure, transfer hook, permanent delegate, default frozen
- **SSS-3 (Private)**: Experimental confidential transfers extension

#### Rust Modules
- **sss-roles**: Role-based access control logic with 7 roles, permission validation, compliance gating (20 unit tests)
- **sss-oracle**: Price feed validation, fiat-to-token conversion, staleness checks (19 unit tests)
- **sss-compliance**: Audit actions, compliance levels, blacklist requirements (16 unit tests)

#### TypeScript SDK (`@stbr/sss-token`)
- `SolanaStablecoin` class with `create`, `load`, `mint`, `burn`, `freeze`, `thaw`, `pause`, `unpause`, `transferAuthority`
- `ComplianceManager` for blacklist and seizure operations
- `RoleManager` for role assignments
- `EventManager` for event subscriptions
- PDA derivation helpers
- Preset configurations
- Error code mappings with custom error parsing
- 5 unit test suites

#### CLI
- `sss-token init` — Initialize stablecoin (supports `--config` for JSON/TOML)
- `sss-token mint` / `burn` — Supply operations
- `sss-token freeze` / `thaw` — Account control
- `sss-token pause` / `unpause` — Global pause
- `sss-token status` / `supply` — Token information
- `sss-token holders` — List token holders
- `sss-token minters` — Manage minter quotas
- `sss-token blacklist` — Blacklist management
- `sss-token seize` — Token seizure
- `sss-token roles` — Role management
- `sss-token audit-log` — Audit trail

#### User Interfaces
- **React Web Dashboard**: 5-tab interface (Create, Dashboard, Mint/Burn, Compliance, Roles) with Solana wallet adapter
- **Terminal UI (Ratatui)**: 5-panel dashboard (Overview, Supply, Holders, Events, Compliance)
- **Backend API (Express)**: REST endpoints for mint, compliance, status, webhooks, event indexing

#### Infrastructure
- Docker support for backend (`Dockerfile` + `docker-compose.yml`)
- CI/CD pipelines (GitHub Actions: lint, test, build, security audit, deploy)
- Deployment scripts (`scripts/deploy.sh`, `scripts/setup.sh`)
- Example configuration files (JSON, TOML)

#### Documentation
- Architecture guide (`docs/ARCHITECTURE.md`)
- Getting started guide (`docs/GETTING_STARTED.md`)
- SDK reference (`docs/SDK_REFERENCE.md`)
- API reference (`docs/API.md`)
- SSS-1 specification (`docs/SSS-1.md`)
- SSS-2 specification (`docs/SSS-2.md`)
- Compliance framework (`docs/COMPLIANCE.md`)
- Operations guide (`docs/OPERATIONS.md`)
- Deployment guide (`docs/DEPLOYMENT.md`)
- Security policy (`SECURITY.md`)

#### Testing
- 55 Rust unit tests across 3 modules
- 53+ TypeScript SDK unit tests
- SSS-1 integration tests (28 test cases)
- SSS-2 integration tests (44+ test cases)
- Trident fuzz test harness with invariant checks

#### Security
- Overflow-protected arithmetic (checked operations)
- PDA-based authorization (deterministic addresses)
- Last admin protection
- Pause gating for mint/burn
- Per-minter quota enforcement
- Compliance role gating (SSS-1 rejects Blacklister/Seizer)
- Fail-closed transfer hook design
- Reserved space for forward-compatible upgrades
