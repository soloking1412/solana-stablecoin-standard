# Deployment Guide

## Overview

This guide covers deploying the Solana Stablecoin Standard programs to devnet and mainnet, including prerequisites, deployment steps, verification, and post-deployment operations.

## Prerequisites

- **Rust** 1.79+ with `rustup`
- **Solana CLI** 1.18+ configured with a funded keypair
- **Anchor CLI** 0.31.1
- **Node.js** 20+ with Yarn

## Program IDs

| Program | Address |
|---------|---------|
| sss-token | `StbMVdQRUykc9jS3bT1LCiHBqBos1awkVHFn2cFRLwR` |
| sss-transfer-hook | `SThk8WNt3JUYTCNwUgMJeLSBbqRbGnFv6xFM4th7giQ` |

## Devnet Deployment

### Step 1: Configure Solana CLI

```bash
solana config set --url devnet
solana config get
```

### Step 2: Fund Deployer

```bash
# Airdrop SOL for deployment
solana airdrop 5
solana airdrop 5
solana balance
```

You need approximately 5-10 SOL for deploying both programs.

### Step 3: Build Programs

```bash
anchor build
```

Verify the build artifacts:
```bash
ls -la target/deploy/
# Should contain:
#   sss_token.so
#   sss_transfer_hook.so
#   sss_token-keypair.json
#   sss_transfer_hook-keypair.json
```

### Step 4: Deploy

```bash
# Deploy both programs
./scripts/deploy.sh devnet

# Or deploy individually
anchor deploy --provider.cluster devnet --program-name sss_token
anchor deploy --provider.cluster devnet --program-name sss_transfer_hook
```

### Step 5: Verify Deployment

```bash
# Check program accounts
solana program show StbMVdQRUykc9jS3bT1LCiHBqBos1awkVHFn2cFRLwR
solana program show SThk8WNt3JUYTCNwUgMJeLSBbqRbGnFv6xFM4th7giQ
```

### Step 6: Run Integration Tests on Devnet

```bash
# Update Anchor.toml cluster
# [provider]
# cluster = "devnet"

anchor test --provider.cluster devnet --skip-local-validator
```

## Devnet Example Operations

After deployment, perform these example operations to verify everything works:

### Initialize an SSS-1 Token

```bash
sss-token init \
  --name "Test USD" \
  --symbol TUSD \
  --decimals 6 \
  --preset sss-1 \
  --cluster devnet
```

### Grant Roles and Mint

```bash
# Grant minter role
sss-token roles grant --role minter --address <YOUR_PUBKEY> --mint <MINT>

# Create quota
sss-token minters add --address <YOUR_PUBKEY> --quota 1000000000 --mint <MINT>

# Mint tokens
sss-token mint --amount 1000000 --to <TOKEN_ACCOUNT> --mint <MINT>
```

### Check Status

```bash
sss-token status --mint <MINT_ADDRESS> --cluster devnet
sss-token supply --mint <MINT_ADDRESS> --cluster devnet
```

## Mainnet Deployment

> **Warning:** Mainnet deployment is irreversible. Ensure thorough testing on devnet first.

### Pre-Deployment Checklist

- [ ] All tests pass on devnet
- [ ] Program has been verified with `anchor verify`
- [ ] Authority keypair is backed up securely
- [ ] Deployment keypairs match declared program IDs
- [ ] Sufficient SOL balance for deployment (~10 SOL)
- [ ] Team has reviewed all code changes
- [ ] Security audit completed (if applicable)

### Deploy to Mainnet

```bash
solana config set --url mainnet-beta
solana balance  # Verify sufficient SOL

./scripts/deploy.sh mainnet-beta
```

### Post-Deployment Verification

```bash
# Verify programs are deployed
solana program show StbMVdQRUykc9jS3bT1LCiHBqBos1awkVHFn2cFRLwR --url mainnet-beta
solana program show SThk8WNt3JUYTCNwUgMJeLSBbqRbGnFv6xFM4th7giQ --url mainnet-beta
```

## Docker Deployment (Backend)

### Build and Run

```bash
cd backend
cp .env.example .env
# Edit .env with production values

docker compose up -d
```

### Production .env

```bash
PORT=3000
SOLANA_RPC_URL=https://api.devnet.solana.com
SSS_TOKEN_PROGRAM_ID=StbMVdQRUykc9jS3bT1LCiHBqBos1awkVHFn2cFRLwR
SSS_HOOK_PROGRAM_ID=SThk8WNt3JUYTCNwUgMJeLSBbqRbGnFv6xFM4th7giQ
AUTHORITY_KEYPAIR_PATH=/app/keys/authority.json
API_KEY=your-secure-api-key
LOG_LEVEL=info
NODE_ENV=production
```

### Health Check

```bash
curl http://localhost:3000/health
# Expected: { "status": "ok" }
```

## Automated Deployment Script

The `scripts/deploy.sh` script automates the deployment process:

```bash
#!/bin/bash
# Usage: ./scripts/deploy.sh <network> [program]
# Examples:
#   ./scripts/deploy.sh devnet           # Deploy all to devnet
#   ./scripts/deploy.sh devnet sss-token # Deploy specific program
#   ./scripts/deploy.sh mainnet-beta     # Deploy all to mainnet
```

Features:
- Network validation (devnet, mainnet-beta)
- SOL balance check before deployment
- Automatic airdrop on devnet
- Build verification
- Deployment confirmation gate for mainnet
- Post-deployment verification

## Upgrade Process

Anchor programs can be upgraded if the deployer retains the upgrade authority:

```bash
# Build new version
anchor build

# Deploy upgrade
anchor upgrade target/deploy/sss_token.so \
  --program-id StbMVdQRUykc9jS3bT1LCiHBqBos1awkVHFn2cFRLwR \
  --provider.cluster devnet
```

### Immutable Deployment

To make a deployment immutable (recommended for production):

```bash
solana program set-upgrade-authority <PROGRAM_ID> --final
```

> **Warning:** This is irreversible. The program can never be upgraded after this.

## Troubleshooting

### Insufficient SOL

```
Error: Insufficient funds for deployment
```

Solution:
```bash
# Devnet
solana airdrop 5

# Mainnet: Transfer SOL from an exchange or wallet
```

### Program ID Mismatch

```
Error: Declared program ID does not match keypair
```

Solution: Ensure `Anchor.toml` program IDs match the keypairs in `target/deploy/`:
```bash
solana-keygen pubkey target/deploy/sss_token-keypair.json
# Should match: StbMVdQRUykc9jS3bT1LCiHBqBos1awkVHFn2cFRLwR
```

### Build Failures

```
Error: Build failed
```

Solution:
```bash
# Clean and rebuild
anchor clean
cargo clean
anchor build
```

### Edition 2024 Errors

If you see errors about `edition2024` in transitive dependencies:

```bash
cargo update -p blake3 --precise 1.6.1
anchor build
```
