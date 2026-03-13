# Contributing

Thank you for your interest in contributing to the Solana Stablecoin Standard!

## Development Setup

```bash
# Clone
git clone https://github.com/superteam-brazil/solana-stablecoin-standard.git
cd solana-stablecoin-standard

# Install prerequisites
# - Rust 1.79+ (rustup.rs)
# - Solana CLI 1.18+ (docs.anza.xyz/cli/install)
# - Anchor 0.31.1 (anchor-lang.com)
# - Node.js 20+ (nodejs.org)
# - Yarn 1.x (npm install -g yarn)

# Automated setup
./scripts/setup.sh

# Or manually
yarn install
anchor build
anchor test
```

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `programs/` | On-chain Anchor programs |
| `modules/` | Reusable Rust libraries |
| `sdk/core/` | TypeScript SDK and CLI |
| `app/` | React web frontend |
| `backend/` | Express.js API server |
| `tui/` | Rust terminal UI |
| `tests/` | Anchor integration tests |
| `trident-tests/` | Fuzz tests |
| `docs/` | Documentation |
| `scripts/` | Setup and deployment scripts |

## Testing

Before submitting a pull request, ensure all tests pass:

```bash
# Rust module unit tests (55 tests)
cargo test -p sss-roles --lib
cargo test -p sss-oracle --lib
cargo test -p sss-compliance --lib

# Fuzz invariant tests (60+ tests)
cargo test -p fuzz_tests --lib

# Anchor integration tests
anchor test

# SDK unit tests
cd sdk/core && yarn test
```

## Code Style

### Rust
- Follow standard Rust formatting: `cargo fmt`
- Ensure no warnings: `cargo clippy`
- Use `checked_` arithmetic for all token amounts

### TypeScript
- Follow project ESLint configuration
- Use TypeScript strict mode
- Prefer `async/await` over raw promises

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear commit messages
3. Ensure all tests pass
4. Update documentation if needed
5. Submit a pull request with a description of changes

## Security

If you discover a security vulnerability, please **do not** open a public issue. Instead, follow the process described in [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
