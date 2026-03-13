# Compliance Framework

## Overview

The Solana Stablecoin Standard provides a comprehensive compliance framework designed for regulated stablecoin issuers. This document covers the compliance architecture, operational procedures, and regulatory considerations.

## Compliance Levels

| Level | Preset | Description |
|-------|--------|-------------|
| None | — | No compliance features |
| Basic | SSS-1 | Freeze/thaw + pause + role management |
| Full | SSS-2 | Blacklist + seizure + transfer hooks + default frozen |
| Private | SSS-3 | Full compliance + confidential transfers (experimental) |

## Compliance Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Compliance Stack                           │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Policy Layer                       │    │
│  │  • Sanctions screening (OFAC, EU, UN)                │    │
│  │  • KYC/AML verification gates                        │    │
│  │  • Transaction monitoring rules                      │    │
│  └─────────────────────┬───────────────────────────────┘    │
│                        │                                     │
│  ┌─────────────────────┴───────────────────────────────┐    │
│  │                Enforcement Layer                      │    │
│  │  • Transfer Hook (blacklist checks)                   │    │
│  │  • Default Frozen (KYC gate)                          │    │
│  │  • Permanent Delegate (seizure)                       │    │
│  │  • Pause mechanism (circuit breaker)                  │    │
│  └─────────────────────┬───────────────────────────────┘    │
│                        │                                     │
│  ┌─────────────────────┴───────────────────────────────┐    │
│  │                  Audit Layer                          │    │
│  │  • 14 event types for complete audit trail            │    │
│  │  • On-chain timestamps for every action               │    │
│  │  • Role attribution (who did what)                    │    │
│  │  • Backend indexer for queryable audit log             │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Role Separation for Compliance

The SSS role model enforces **separation of duties** — a critical compliance requirement:

| Function | Role | Rationale |
|----------|------|-----------|
| System administration | Admin | Manages operational roles, not token operations |
| Supply management | Minter + Burner | Separate mint and burn authority |
| Account control | Freezer | Can freeze/thaw but cannot mint or seize |
| Emergency stop | Pauser | Can halt all operations globally |
| Sanctions enforcement | Blacklister | Can block addresses from transacting |
| Asset recovery | Seizer | Can seize tokens only from frozen accounts |

**Key principle:** No single role can perform the complete chain of issuing, freezing, and seizing tokens. This reduces the risk of insider abuse.

## Blacklist Management

### Blacklist Workflow

```
┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  Compliance  │     │  Blacklister  │     │   On-Chain   │
│   Officer    │────▶│  Role Holder  │────▶│  BlacklistPDA│
│              │     │               │     │              │
│ Reviews OFAC │     │ Executes      │     │ Created with │
│ screening    │     │ blacklist_add │     │ reason &     │
│ results      │     │               │     │ timestamp    │
└──────────────┘     └───────────────┘     └──────────────┘
                                                  │
                                                  ▼
                                           Transfer Hook
                                           blocks all
                                           transfers
```

### Adding to Blacklist

```typescript
// Via SDK
await stablecoin.compliance.addToBlacklist(
  address,
  "OFAC SDN List - 2024-03-15",
  blacklisterKeypair
);

// Via CLI
sss-token blacklist add \
  --address <ADDRESS> \
  --reason "OFAC sanctions" \
  --mint <MINT>
```

### Removing from Blacklist

```typescript
// Via SDK
await stablecoin.compliance.removeFromBlacklist(
  address,
  blacklisterKeypair
);

// Via CLI
sss-token blacklist remove --address <ADDRESS> --mint <MINT>
```

### Blacklist Verification

```typescript
const isBlocked = await stablecoin.compliance.isBlacklisted(address);
```

## KYC/AML Gate (Default Frozen)

SSS-2 tokens use `DefaultAccountState::Frozen` so new accounts start frozen. This creates a natural KYC checkpoint:

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  User    │    │   KYC    │    │  Freezer │    │  Account │
│  Opens   │───▶│  Check   │───▶│  Thaws   │───▶│  Active  │
│  Account │    │  (off-   │    │  Account │    │  & Ready │
│          │    │  chain)  │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

**Implementation pattern:**
1. User creates a token account (starts frozen)
2. Off-chain KYC service verifies the user
3. Upon verification, backend calls `thaw_account` via the Freezer role
4. Account is now active and can participate in transfers

## Seizure Process

Token seizure is the most sensitive compliance operation. It is designed with multiple safeguards:

### Prerequisites
1. Target account must be **frozen** first
2. Caller must have **Seizer** role (only available on SSS-2+)
3. Only the Admin can grant the Seizer role

### Seizure Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Court   │    │  Freezer │    │  Seizer  │    │  Tokens  │
│  Order   │───▶│  Freezes │───▶│  Seizes  │───▶│  Moved   │
│          │    │  Account │    │  Tokens  │    │  to      │
│          │    │          │    │          │    │  Treasury│
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### Code Example

```typescript
// Step 1: Freeze the target account
await stablecoin.freeze(targetTokenAccount, freezerKeypair);

// Step 2: Seize tokens to treasury
await stablecoin.compliance.seize(
  targetTokenAccount,
  treasuryTokenAccount,
  seizerKeypair
);
```

## Audit Trail

Every compliance-relevant action emits an on-chain event with:
- **Timestamp:** Unix timestamp from Solana clock
- **Actor:** Public key of the role holder who performed the action
- **Target:** Affected account/address
- **Details:** Amount, reason, or other action-specific data

### Audit Event Types

| Event | Compliance Relevance |
|-------|---------------------|
| `TokenInitialized` | Token lifecycle start |
| `TokensMinted` | Supply increase — tracks minter and amount |
| `TokensBurned` | Supply decrease — tracks burner and amount |
| `AccountFrozen` | Account restriction — tracks operator |
| `AccountThawed` | Account activation — tracks operator |
| `TokenPaused` | Emergency halt — tracks operator |
| `TokenUnpaused` | Recovery — tracks operator |
| `RoleGranted` | Access change — tracks grantor |
| `RoleRevoked` | Access change — tracks revoker |
| `MinterQuotaUpdated` | Supply control change — tracks admin |
| `AuthorityTransferred` | Ownership change — tracks both parties |
| `AddressBlacklisted` | Sanctions action — tracks reason and operator |
| `AddressUnblacklisted` | Sanctions removal — tracks operator |
| `TokensSeized` | Asset recovery — tracks amount, from, to, operator |

### Querying Audit Log

```bash
# CLI
sss-token audit-log --limit 50

# Backend API
curl http://localhost:3000/api/compliance/audit-log?limit=50
```

## Compliance Module (Rust)

The `sss-compliance` module provides off-chain compliance utilities:

```rust
use sss_compliance::{AuditAction, ComplianceLevel, is_compliant_action, format_audit_entry};

// Check if an action is allowed at a compliance level
let allowed = is_compliant_action(&AuditAction::Seize, &ComplianceLevel::Full);

// Format audit entry for logging
let entry = format_audit_entry(&AuditAction::BlacklistAdd, timestamp, actor, target);
```

### Audit Actions (13 types)

```rust
pub enum AuditAction {
    Initialize,
    Mint,
    Burn,
    Freeze,
    Thaw,
    Pause,
    Unpause,
    GrantRole,
    RevokeRole,
    UpdateQuota,
    BlacklistAdd,
    BlacklistRemove,
    Seize,
}
```

## Regulatory Considerations

### Travel Rule Compliance

SSS-2's event system provides the data needed for Travel Rule compliance. All mint, burn, and seizure events include sender/recipient information that can be matched with off-chain identity records.

### Sanctions Screening

The blacklist system can be integrated with sanctions screening services:

1. **OFAC SDN List** — Screen addresses against US sanctions
2. **EU Sanctions** — European Union restrictive measures
3. **UN Security Council** — International sanctions
4. **Custom lists** — Organization-specific blocked addresses

### Data Retention

On-chain events are immutable and permanent. For GDPR compliance, personal data should be stored off-chain with only public keys referenced on-chain.

### Multi-Jurisdiction

SSS-2's flexible role model supports multi-jurisdiction compliance:
- Assign different Blacklisters for different jurisdictions
- Use the Backend API to automate jurisdiction-specific screening
- Maintain separate audit trails per compliance team

## Backend Integration

The Express.js backend provides REST endpoints for compliance operations:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /api/compliance/blacklist` | POST | Add address to blacklist |
| `DELETE /api/compliance/blacklist/:address` | DELETE | Remove from blacklist |
| `GET /api/compliance/blacklist/:address` | GET | Check blacklist status |
| `GET /api/compliance/audit-log` | GET | Query audit log |
| `POST /api/compliance/seize` | POST | Seize tokens |

## Webhooks

The backend supports webhooks for real-time compliance monitoring:

```json
{
  "url": "https://your-compliance-system.com/webhook",
  "events": ["blacklist_add", "blacklist_remove", "seize", "freeze"],
  "secret": "webhook-secret-key"
}
```

Configure via:
```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{"url": "...", "events": ["blacklist_add", "seize"]}'
```
