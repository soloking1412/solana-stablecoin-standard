#!/usr/bin/env bash
# deploy.sh — Deploy programs to Solana cluster
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

NETWORK="${1:-devnet}"
PROGRAM="${2:-all}"

echo -e "${BOLD}🚀 Solana Stablecoin Standard — Deploy${NC}"
echo ""
echo "  Network: $NETWORK"
echo "  Program: $PROGRAM"
echo ""

# ── Validate ─────────────────────────────────────────────────────
if [[ "$NETWORK" == "mainnet-beta" ]]; then
  echo -e "${YELLOW}⚠  You are deploying to MAINNET.${NC}"
  read -rp "Type 'yes' to confirm: " CONFIRM
  if [[ "$CONFIRM" != "yes" ]]; then
    error "Aborted."
  fi
fi

# ── Configure ────────────────────────────────────────────────────
solana config set --url "$NETWORK"
info "Solana CLI set to $NETWORK"

BALANCE=$(solana balance | awk '{print $1}')
echo "  Deployer balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 3" | bc -l) )); then
  if [[ "$NETWORK" == "devnet" ]]; then
    warn "Low balance. Requesting airdrop..."
    solana airdrop 2 || warn "Airdrop failed (rate limit?)"
  else
    error "Insufficient balance for deployment. Need at least 3 SOL."
  fi
fi

# ── Build ────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Building programs...${NC}"
anchor build
info "Build complete"

# ── Deploy ───────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Deploying...${NC}"

if [[ "$PROGRAM" == "all" || "$PROGRAM" == "sss-token" ]]; then
  echo "Deploying sss-token..."
  anchor deploy --program-name sss_token --provider.cluster "$NETWORK"
  info "sss-token deployed"
fi

if [[ "$PROGRAM" == "all" || "$PROGRAM" == "sss-transfer-hook" ]]; then
  echo "Deploying sss-transfer-hook..."
  anchor deploy --program-name sss_transfer_hook --provider.cluster "$NETWORK"
  info "sss-transfer-hook deployed"
fi

# ── Verify ───────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Verifying deployment...${NC}"
solana program show StbMVdQRUykc9jS3bT1LCiHBqBos1awkVHFn2cFRLwR || true
solana program show SThk8WNt3JUYTCNwUgMJeLSBbqRbGnFv6xFM4th7giQ || true

echo ""
echo -e "${BOLD}${GREEN}✅ Deployment complete!${NC}"
