# Operations Guide

## Overview

This guide covers day-to-day operations for managing a Solana Stablecoin Standard token, including deployment, role management, supply operations, compliance workflows, monitoring, and incident response.

## Deployment

### Prerequisites

- Solana CLI configured with the deployer keypair
- Sufficient SOL for program deployment (~5 SOL for devnet, ~10 SOL for mainnet)
- Anchor CLI 0.31.1 installed

### Deploy to Devnet

```bash
# Automated deployment
./scripts/deploy.sh devnet

# Manual deployment
solana config set --url devnet
anchor build
anchor deploy --provider.cluster devnet
```

### Deploy to Mainnet

```bash
# Requires explicit confirmation
./scripts/deploy.sh mainnet-beta
```

### Verify Deployment

```bash
# Check program is deployed
solana program show <PROGRAM_ID>

# Verify program data
anchor verify <PROGRAM_ID> --provider.cluster devnet
```

## Token Lifecycle

### 1. Initialize Token

```bash
# SSS-1 (minimal)
sss-token init \
  --name "My Stablecoin" \
  --symbol MUSD \
  --decimals 6 \
  --preset sss-1 \
  --cluster devnet

# SSS-2 (compliant)
sss-token init \
  --name "Regulated USD" \
  --symbol RUSD \
  --decimals 6 \
  --preset sss-2 \
  --cluster devnet
```

### 2. Set Up Roles

```bash
# Grant operational roles
sss-token roles grant --role minter --address <MINTER_PUBKEY>
sss-token roles grant --role burner --address <BURNER_PUBKEY>
sss-token roles grant --role freezer --address <FREEZER_PUBKEY>
sss-token roles grant --role pauser --address <PAUSER_PUBKEY>

# SSS-2 only
sss-token roles grant --role blacklister --address <COMPLIANCE_PUBKEY>
sss-token roles grant --role seizer --address <LEGAL_PUBKEY>
```

### 3. Create Minter Quotas

```bash
# Set initial minting quota (1M tokens with 6 decimals)
sss-token minters add --address <MINTER_PUBKEY> --quota 1000000000000
```

### 4. Begin Operations

```bash
# Mint tokens
sss-token mint --amount 1000000 --to <RECIPIENT_TOKEN_ACCOUNT>

# Check status
sss-token status --mint <MINT_ADDRESS>

# View supply
sss-token supply --mint <MINT_ADDRESS>
```

## Supply Management

### Minting

```bash
# Mint to a specific account
sss-token mint --amount <AMOUNT> --to <TOKEN_ACCOUNT>

# Check minter quota usage
sss-token minters list
```

**Best practices:**
- Maintain separate Minter keypairs for different operation teams
- Set conservative quotas and increase as needed
- Monitor `total_minted` against expected supply targets

### Burning

```bash
# Burn from a specific account
sss-token burn --amount <AMOUNT> --from <TOKEN_ACCOUNT>
```

### Supply Monitoring

```bash
# View supply breakdown
sss-token supply --mint <MINT_ADDRESS>

# Output:
#   Minted:      10,000,000
#   Burned:       1,500,000
#   Circulating:  8,500,000
```

### Quota Management

```bash
# View all minters and their quotas
sss-token minters list

# Update an existing quota
sss-token minters update --address <MINTER> --quota <NEW_QUOTA>
```

## Account Management

### Freeze an Account

```bash
sss-token freeze --account <TOKEN_ACCOUNT> --mint <MINT_ADDRESS>
```

Use cases:
- Suspected fraud investigation
- Compliance hold
- Court order

### Thaw an Account

```bash
sss-token thaw --account <TOKEN_ACCOUNT> --mint <MINT_ADDRESS>
```

### View Holders

```bash
# List all holders
sss-token holders --mint <MINT_ADDRESS>

# Filter by minimum balance
sss-token holders --mint <MINT_ADDRESS> --min-balance 1000000

# Limit results
sss-token holders --mint <MINT_ADDRESS> --limit 50
```

## Emergency Procedures

### Global Pause

In case of a security incident or regulatory requirement:

```bash
# Pause all operations
sss-token pause --mint <MINT_ADDRESS>
```

**What happens when paused:**
- ❌ Minting is blocked
- ❌ Burning is blocked
- ✅ Transfers still work (Token-2022 level, not controlled by our program)
- ✅ Freeze/thaw still works
- ✅ Role management still works
- ✅ Blacklist management still works

### Resume Operations

```bash
sss-token unpause --mint <MINT_ADDRESS>
```

### Authority Transfer

In case the admin keypair needs rotation:

```bash
sss-token authority transfer \
  --new-authority <NEW_AUTHORITY_PUBKEY> \
  --mint <MINT_ADDRESS>
```

> **Warning:** This is a one-step operation. Ensure the new authority keypair is secure and backed up.

## Compliance Operations (SSS-2)

### Blacklist Workflow

```bash
# Add to blacklist
sss-token blacklist add \
  --address <SUSPICIOUS_ADDRESS> \
  --reason "OFAC SDN List match" \
  --mint <MINT_ADDRESS>

# Verify blacklist status
sss-token blacklist check --address <ADDRESS> --mint <MINT_ADDRESS>

# Remove from blacklist
sss-token blacklist remove \
  --address <ADDRESS> \
  --mint <MINT_ADDRESS>
```

### Seizure Workflow

```bash
# Step 1: Freeze the account
sss-token freeze --account <TARGET_TOKEN_ACCOUNT> --mint <MINT_ADDRESS>

# Step 2: Seize tokens to treasury
sss-token seize \
  --from <TARGET_TOKEN_ACCOUNT> \
  --to <TREASURY_TOKEN_ACCOUNT> \
  --mint <MINT_ADDRESS>
```

### Audit Log

```bash
# View recent operations
sss-token audit-log --limit 50 --mint <MINT_ADDRESS>

# Filter by action type
sss-token audit-log --action mint --limit 20
sss-token audit-log --action blacklist --limit 20
```

## Monitoring

### Backend API Health

```bash
# Health check
curl http://localhost:3000/health

# Token status
curl http://localhost:3000/api/status/<MINT_ADDRESS>
```

### TUI Dashboard

```bash
cd tui && cargo run -- --mint <MINT_ADDRESS> --rpc https://api.devnet.solana.com
```

The TUI provides real-time panels for:
- **Overview:** Token name, symbol, preset, pause status
- **Supply:** Minted, burned, circulating
- **Holders:** Top token holders with balances
- **Events:** Recent on-chain events
- **Compliance:** Blacklist entries (SSS-2)

### Web Dashboard

```bash
cd app && yarn dev
# Open http://localhost:5173
```

## Backend Deployment

### Docker

```bash
cd backend
cp .env.example .env
# Edit .env with your settings

docker compose up -d
```

### Manual

```bash
cd backend
yarn install
yarn build
NODE_ENV=production node dist/index.js
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | API server port |
| `SOLANA_RPC_URL` | localhost:8899 | Solana RPC endpoint |
| `SSS_TOKEN_PROGRAM_ID` | (program ID) | SSS-Token program address |
| `SSS_HOOK_PROGRAM_ID` | (program ID) | Transfer hook program address |
| `AUTHORITY_KEYPAIR_PATH` | ~/.config/solana/id.json | Authority keypair |
| `API_KEY` | — | API authentication key |
| `LOG_LEVEL` | info | Logging level (debug, info, warn, error) |

## Operational Runbooks

### Runbook: New Minter Onboarding

1. Verify minter identity and authorization
2. Grant Minter role: `sss-token roles grant --role minter --address <PUBKEY>`
3. Create quota: `sss-token minters add --address <PUBKEY> --quota <AMOUNT>`
4. Test with a small mint operation
5. Document in operational log

### Runbook: Sanctions Alert

1. Receive alert from screening service
2. Verify the match (false positive check)
3. If confirmed: `sss-token blacklist add --address <PUBKEY> --reason "OFAC match"`
4. If tokens need seizure:
   a. `sss-token freeze --account <TOKEN_ACCOUNT>`
   b. `sss-token seize --from <TOKEN_ACCOUNT> --to <TREASURY>`
5. Report to compliance officer
6. Document in audit log

### Runbook: Security Incident

1. **Immediate:** Pause the token: `sss-token pause`
2. **Assess:** Review recent audit log for unauthorized activity
3. **Contain:** Freeze compromised accounts
4. **Rotate:** If authority key compromised, transfer to new authority
5. **Recover:** Resume operations after assessment
6. **Post-mortem:** Document and update procedures

### Runbook: Key Rotation

1. Generate new keypair: `solana-keygen new -o new-authority.json`
2. Back up new keypair securely
3. Transfer authority: `sss-token authority transfer --new-authority <NEW_PUBKEY>`
4. Verify: `sss-token status` shows new authority
5. Securely destroy old keypair
6. Update all team configurations

## Custom Configuration

### JSON Config

```json
{
  "name": "My Stablecoin",
  "symbol": "MUSD",
  "decimals": 6,
  "preset": 1,
  "uri": "https://example.com/metadata.json"
}
```

### TOML Config

```toml
name = "My Stablecoin"
symbol = "MUSD"
decimals = 6
preset = 2
uri = "https://example.com/metadata.json"

[extensions]
permanentDelegate = true
transferHook = true
defaultAccountFrozen = true
```

```bash
sss-token init --config ./config.toml
```
