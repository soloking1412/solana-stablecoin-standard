# Getting Started

## Prerequisites

- **Rust** 1.79+ — [rustup.rs](https://rustup.rs)
- **Solana CLI** 1.18+ — [Install Guide](https://docs.anza.xyz/cli/install)
- **Anchor** 0.31.1 — [anchor-lang.com](https://www.anchor-lang.com/docs/installation)
- **Node.js** 20+ — [nodejs.org](https://nodejs.org)
- **Yarn** 1.x — `npm install -g yarn`

## Quick Start

```bash
# Clone the repo
git clone https://github.com/superteam-brazil/solana-stablecoin-standard.git
cd solana-stablecoin-standard

# Run automated setup
./scripts/setup.sh

# Or manually:
yarn install
anchor build
anchor test
```

## Project Layout

```
├── programs/           On-chain Anchor programs
│   ├── sss-token/      Core stablecoin program
│   └── sss-transfer-hook/  Transfer hook for blacklists
├── modules/            Reusable Rust libraries
│   ├── sss-roles/      Role-based access control
│   ├── sss-oracle/     Price feed integration
│   └── sss-compliance/ Compliance framework
├── sdk/core/           TypeScript SDK & CLI
├── app/                React web frontend
├── backend/            Express.js API server
├── tui/                Rust terminal dashboard
├── tests/              Anchor integration tests
└── scripts/            Dev & deployment scripts
```

## Creating a Stablecoin

### Using the CLI

```bash
# Install CLI globally
cd sdk/core && yarn build && npm link

# Initialize an SSS-1 (minimal) stablecoin
sss-token init --name "My USD" --symbol MUSD --decimals 6 --preset 1

# Initialize an SSS-2 (compliant) stablecoin
sss-token init --name "Regulated USD" --symbol RUSD --decimals 6 --preset 2
```

### Using the SDK

```typescript
import { SolanaStablecoin } from "@stbr/sss-token";
import { Connection, Keypair } from "@solana/web3.js";

const connection = new Connection("http://localhost:8899");
const authority = Keypair.generate();

const stablecoin = await SolanaStablecoin.create(connection, authority, {
  name: "My USD",
  symbol: "MUSD",
  decimals: 6,
  preset: 1,
});
```

### Using the Web App

```bash
cd app
yarn install
yarn dev
# Open http://localhost:5173
```

## Running Tests

```bash
# All integration tests (requires local validator)
anchor test

# Rust module unit tests only
cargo test -p sss-roles --lib
cargo test -p sss-oracle --lib
cargo test -p sss-compliance --lib

# SDK unit tests
yarn test:sdk
```

## Deployment

```bash
# Deploy to devnet
./scripts/deploy.sh devnet

# Deploy to mainnet (requires confirmation)
./scripts/deploy.sh mainnet-beta

# Deploy a specific program only
./scripts/deploy.sh devnet sss-token
```

## Common Operations

### Manage Roles

```bash
# Grant minter role
sss-token minters add --address <PUBKEY> --quota 1000000

# View current minters
sss-token minters list

# Check stablecoin status
sss-token status
```

### Mint & Burn

```bash
# Mint tokens
sss-token mint --amount 1000 --to <RECIPIENT>

# Burn tokens
sss-token burn --amount 500 --from <TOKEN_ACCOUNT>
```

### Compliance (SSS-2 only)

```bash
# Add address to blacklist
sss-token blacklist add --address <PUBKEY> --reason "Sanctions"

# Remove from blacklist
sss-token blacklist remove --address <PUBKEY>

# Seize tokens from frozen account
sss-token seize --from <TOKEN_ACCOUNT> --to <TREASURY>
```

## Configuration

### Environment Variables (Backend)

```bash
PORT=3000
SOLANA_RPC_URL=https://api.devnet.solana.com
SSS_TOKEN_PROGRAM_ID=StbMVdQRUykc9jS3bT1LCiHBqBos1awkVHFn2cFRLwR
SSS_HOOK_PROGRAM_ID=SThk8WNt3JUYTCNwUgMJeLSBbqRbGnFv6xFM4th7giQ
AUTHORITY_KEYPAIR_PATH=~/.config/solana/authority.json
API_KEY=your-api-key
LOG_LEVEL=info
```

### Anchor.toml

The cluster and wallet settings are configured in `Anchor.toml`. By default the project targets localnet for development:

```toml
[provider]
cluster = "Localnet"
wallet = "~/.config/solana/id.json"
```

## Next Steps

- Read the [Architecture Guide](./ARCHITECTURE.md) for design details
- Read the [SDK Reference](./SDK_REFERENCE.md) for full API documentation
- Review test files in `tests/` for usage examples
