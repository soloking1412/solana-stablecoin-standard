#!/usr/bin/env bash
# setup.sh — Bootstrap local development environment
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

echo -e "${BOLD}🔧 Solana Stablecoin Standard — Setup${NC}"
echo ""

# ── Check prerequisites ──────────────────────────────────────────
check_cmd() {
  if command -v "$1" &>/dev/null; then
    info "$1 found: $(command -v "$1")"
    return 0
  else
    error "$1 not found"
    return 1
  fi
}

MISSING=0

echo -e "${BOLD}Checking prerequisites...${NC}"
check_cmd rustc   || MISSING=1
check_cmd cargo   || MISSING=1
check_cmd solana  || MISSING=1
check_cmd anchor  || MISSING=1
check_cmd node    || MISSING=1
check_cmd yarn    || MISSING=1

if [ "$MISSING" -eq 1 ]; then
  echo ""
  error "Missing dependencies. Please install them first:"
  echo "  Rust:   https://rustup.rs"
  echo "  Solana: https://docs.anza.xyz/cli/install"
  echo "  Anchor: https://www.anchor-lang.com/docs/installation"
  echo "  Node:   https://nodejs.org"
  echo "  Yarn:   npm install -g yarn"
  exit 1
fi

echo ""
echo -e "${BOLD}Versions:${NC}"
echo "  Rust:   $(rustc --version)"
echo "  Solana: $(solana --version)"
echo "  Anchor: $(anchor --version)"
echo "  Node:   $(node --version)"
echo "  Yarn:   $(yarn --version)"

# ── Setup Solana keypair ─────────────────────────────────────────
echo ""
echo -e "${BOLD}Configuring Solana...${NC}"

if [ ! -f "$HOME/.config/solana/id.json" ]; then
  warn "No default keypair found. Generating one..."
  solana-keygen new --no-bip39-passphrase --outfile "$HOME/.config/solana/id.json"
fi

solana config set --url localhost
info "Solana configured for localhost"

# ── Install dependencies ─────────────────────────────────────────
echo ""
echo -e "${BOLD}Installing dependencies...${NC}"
yarn install
info "Node dependencies installed"

# ── Build programs ───────────────────────────────────────────────
echo ""
echo -e "${BOLD}Building Anchor programs...${NC}"
anchor build
info "Programs built successfully"

# ── Run module tests ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}Running Rust module tests...${NC}"
cargo test -p sss-roles --lib 2>&1 | tail -1
cargo test -p sss-oracle --lib 2>&1 | tail -1
cargo test -p sss-compliance --lib 2>&1 | tail -1
info "All module tests passed"

echo ""
echo -e "${BOLD}${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Start local validator:  solana-test-validator"
echo "  2. Run integration tests:  anchor test"
echo "  3. Start web app:          cd app && yarn dev"
echo "  4. Start backend:          cd backend && yarn dev"
echo ""
