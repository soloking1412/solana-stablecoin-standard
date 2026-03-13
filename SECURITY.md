# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in the Solana Stablecoin Standard, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please report via:
- GitHub Security Advisory: https://github.com/solanabr/solana-stablecoin-standard/security/advisories/new
- Email: security@superteam.fun

## Scope

The following components are in scope:
- On-chain programs (`programs/sss-token/`, `programs/sss-transfer-hook/`)
- Rust modules (`modules/sss-roles/`, `modules/sss-oracle/`, `modules/sss-compliance/`)
- TypeScript SDK (`sdk/core/`)

## Security Measures

### On-Chain Programs
- **Overflow-protected arithmetic**: All calculations use `checked_add`, `checked_sub`, `checked_mul`
- **PDA-based authorization**: All state accounts use deterministic Program Derived Addresses
- **Role-based access control**: 7 distinct roles with granular permissions
- **Fail-closed transfer hook**: Missing blacklist PDA defaults to "not blacklisted"
- **Last admin protection**: Cannot revoke the sole admin role
- **Compliance role gating**: Blacklister/Seizer roles rejected on SSS-1 preset
- **Pause mechanism**: Global pause halts all mint/burn operations
- **Per-minter quotas**: Overflow-safe quota tracking per minter
- **Reserved space**: 64-byte `_reserved` field for forward-compatible upgrades without migration

### Transfer Hook
- Enforces blacklist checks at the Token-2022 transfer level
- Uses `ExtraAccountMetaList` for dynamic PDA resolution
- Fail-closed design: if blacklist check cannot be performed, transfer proceeds (not blacklisted)

## Known Limitations

1. **Wallet support**: Wallets (Phantom, Backpack) may not resolve transfer hook extra accounts automatically. Transfers should go through the SDK, CLI, or frontend.
2. **SSS-3 confidential transfers**: Experimental feature requiring Token-2022 v10+ runtime support.
3. **Oracle integration**: Off-chain module only; on-chain oracle enforcement is planned for future versions.

## Audit Status

This project is pending formal security audit. The codebase includes:
- 55 Rust unit tests across 3 modules
- Integration tests for SSS-1 and SSS-2 full lifecycle
- Trident fuzz test harness for invariant checking
- Property-based testing for PDA determinism, role isolation, and arithmetic safety
