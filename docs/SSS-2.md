# SSS-2: Compliant Stablecoin Standard

## Overview

SSS-2 extends SSS-1 with compliance features required for regulated fiat-backed stablecoins. It leverages three Token-2022 extensions — **Permanent Delegate**, **Transfer Hook**, and **Default Account State** — to enforce blacklist-based transfer restrictions, token seizure, and default-frozen accounts.

**Best for:** Regulated fiat-backed tokens (USDC/USDT-class), central bank digital currencies (CBDCs), securities tokens, and any issuer with KYC/AML requirements.

## Feature Matrix

| Feature | Status | Description |
|---------|--------|-------------|
| All SSS-1 Features | ✅ | Mint/burn, freeze/thaw, pause, roles, quotas |
| Permanent Delegate | ✅ | Config PDA is permanent delegate for seizure |
| Transfer Hook | ✅ | sss-transfer-hook enforces blacklist on every transfer |
| Default Account Frozen | ✅ | New accounts start frozen (KYC gate) |
| Blacklist Management | ✅ | Add/remove addresses with reason tracking |
| Token Seizure | ✅ | Seize tokens from frozen accounts to treasury |
| 7-Role RBAC | ✅ | Admin, Minter, Burner, Freezer, Pauser, Blacklister, Seizer |
| Event Audit Trail | ✅ | 14 event types for complete compliance audit |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     sss-token program                        │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────┐  │
│  │initialize│  │mint_tokens│  │burn_tokens │  │freeze/thaw│  │
│  ├──────────┤  ├──────────┤  ├───────────┤  ├───────────┤  │
│  │pause     │  │grant_role│  │revoke_role │  │quotas     │  │
│  ├──────────┤  ├──────────┤  ├───────────┤  ├───────────┤  │
│  │blacklist │  │blacklist │  │  seize     │  │xfer_auth  │  │
│  │  _add    │  │ _remove  │  │            │  │           │  │
│  └──────────┘  └──────────┘  └───────────┘  └───────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
           ┌───────────┴───────────┐
           │  sss-transfer-hook    │
           │                       │
           │  initialize_metas()   │
           │  execute() ─────────┐ │
           │    ├─ check src BL  │ │
           │    └─ check dst BL  │ │
           └───────────┬─────────┘ │
                       │           │
           ┌───────────┴──────────────────────────┐
           │           Token-2022 Mint              │
           │  Mint Authority: Config PDA            │
           │  Freeze Authority: Config PDA          │
           │  Permanent Delegate: Config PDA        │
           │  Transfer Hook: sss-transfer-hook      │
           │  Default State: Frozen                 │
           └────────────────────────────────────────┘
```

## Token-2022 Extensions

### Permanent Delegate

The `StablecoinConfig` PDA is set as the **Permanent Delegate** during initialization. This allows the program to transfer (seize) tokens from any token account without the owner's signature — a regulatory requirement for sanctions enforcement.

### Transfer Hook

The `sss-transfer-hook` program is registered as the transfer hook. On every Token-2022 transfer, it:

1. Derives the sender's blacklist PDA: `["blacklist", config, source_owner]`
2. Derives the recipient's blacklist PDA: `["blacklist", config, destination_owner]`
3. If either PDA exists → **transfer rejected** with `AddressBlacklisted`
4. If neither exists → **transfer proceeds**

```
User Transfer → Token-2022 → sss-transfer-hook::execute()
                                    │
                   ┌────────────────┴────────────────┐
                   ▼                                  ▼
             Check Source                       Check Destination
             Blacklist PDA                      Blacklist PDA
                   │                                  │
             ┌─────┴─────┐                      ┌─────┴─────┐
             │PDA exists?│                      │PDA exists?│
             │Yes → FAIL │                      │Yes → FAIL │
             │No  → OK   │                      │No  → OK   │
             └───────────┘                      └───────────┘
```

The hook uses `ExtraAccountMetaList` with `Seed::AccountKey` resolution for dynamic PDA derivation during transfer.

### Default Account State (Frozen)

All new token accounts are created in a **frozen** state. This enforces a KYC/AML gate: an issuer with the Freezer role must explicitly thaw an account before it can send or receive transfers. This prevents unverified addresses from participating.

## Additional Account: BlacklistEntry

Seeds: `["blacklist", config.key(), address.key()]`

```rust
pub struct BlacklistEntry {
    pub config: Pubkey,
    pub address: Pubkey,
    pub reason: String,         // Max 128 chars (sanctions, fraud, etc.)
    pub blacklisted_by: Pubkey,
    pub blacklisted_at: i64,
    pub bump: u8,
}
```

## Additional Roles (SSS-2)

| Role | ID | Permissions |
|------|----|-------------|
| Blacklister | 5 | Add / remove blacklist entries |
| Seizer | 6 | Seize tokens from frozen accounts |

These roles are **rejected on SSS-1** preset (`ComplianceRoleNotAllowed`).

## Compliance Operations

### Add to Blacklist

Requires: `Blacklister` role.

```typescript
await stablecoin.compliance.addToBlacklist(
  suspiciousAddress,
  "OFAC sanctions list",
  blacklisterKeypair
);
```

**Effects:**
- Creates `BlacklistEntry` PDA for the address
- Transfer hook will block all transfers from/to this address
- Emits `AddressBlacklisted` event with reason

### Remove from Blacklist

Requires: `Blacklister` role.

```typescript
await stablecoin.compliance.removeFromBlacklist(
  address,
  blacklisterKeypair
);
```

### Check Blacklist Status

```typescript
const isBlocked = await stablecoin.compliance.isBlacklisted(address);
```

### Seize Tokens

Requires: `Seizer` role. Target account must be **frozen**.

```typescript
await stablecoin.compliance.seize(
  frozenTokenAccount,
  treasuryTokenAccount,
  seizerKeypair
);
```

**Flow:**
1. Verify target account is frozen
2. Use Permanent Delegate authority to transfer all tokens
3. Emit `TokensSeized` event with amount and parties

## Initialization

```bash
# CLI
sss-token init --name "Regulated USD" --symbol RUSD --decimals 6 --preset sss-2

# Config file
sss-token init --config ./sss-2-config.toml
```

```toml
# sss-2-config.toml
name = "Regulated USD"
symbol = "RUSD"
decimals = 6
preset = 2
uri = "https://example.com/rusd-metadata.json"

[extensions]
permanentDelegate = true
transferHook = true
defaultAccountFrozen = true
```

## Events (SSS-2 Additional)

| Event | Fields | Emitted When |
|-------|--------|-------------|
| `AddressBlacklisted` | config, address, reason, blacklisted_by | Address added to blacklist |
| `AddressUnblacklisted` | config, address, removed_by | Address removed from blacklist |
| `TokensSeized` | config, from, to, amount, seized_by | Tokens seized from frozen account |
| `AuthorityTransferred` | config, old_authority, new_authority | Authority ownership changed |

## Security Considerations

### Fail-Closed Transfer Hook

The transfer hook's blacklist check is **fail-closed**: if a blacklist PDA does not exist for an address, the address is considered **not blacklisted** and the transfer proceeds. This is the safe default because:

- Legitimate addresses have no blacklist PDA → transfers succeed
- Blacklisted addresses have a PDA → transfers fail
- The hook cannot be bypassed because Token-2022 always invokes it

### Permanent Delegate Risks

The Permanent Delegate has unrestricted transfer authority. Mitigations:

1. **PDA-controlled:** The delegate is a Config PDA, not an EOA
2. **Role-gated seizure:** Only the `Seizer` role can invoke `seize`
3. **Frozen requirement:** Seizure only works on frozen accounts
4. **Audit trail:** Every seizure emits `TokensSeized` event

### Default Frozen Accounts

New accounts start frozen, which means:

- Users cannot transfer until a Freezer thaws their account
- This provides a natural KYC checkpoint
- Issuers should build onboarding flows that thaw after verification

## Test Coverage

SSS-2 is tested with additional integration tests covering:
- SSS-2 initialization with compliance features enabled
- Blacklister and Seizer role grants
- Blacklist add/remove operations
- Seizure from frozen accounts
- Transfer hook integration (blacklist enforcement during transfers)
- Rejection of compliance operations on SSS-1 tokens

## Upgrade from SSS-1

SSS-1 tokens **cannot be upgraded to SSS-2** in-place because Token-2022 extensions (Permanent Delegate, Transfer Hook, Default Account State) must be configured at mint creation time. To migrate:

1. Deploy a new SSS-2 stablecoin
2. Snapshot all SSS-1 holder balances
3. Mint equivalent amounts on the SSS-2 token
4. Have holders claim their new tokens
5. Burn remaining SSS-1 supply
