use borsh::{BorshDeserialize, BorshSerialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OracleError {
    PriceStale,
    ConfidenceTooWide,
    PriceNegative,
    Overflow,
    InvalidExponent,
}

impl fmt::Display for OracleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OracleError::PriceStale => write!(f, "price feed is stale"),
            OracleError::ConfidenceTooWide => write!(f, "confidence interval too wide"),
            OracleError::PriceNegative => write!(f, "negative price"),
            OracleError::Overflow => write!(f, "arithmetic overflow"),
            OracleError::InvalidExponent => write!(f, "invalid price exponent"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, BorshSerialize, BorshDeserialize)]
#[repr(u8)]
pub enum CurrencyPair {
    UsdUsd = 0,
    BrlUsd = 1,
    EurUsd = 2,
    CpiUsd = 3,
}

#[derive(Debug, Clone, BorshSerialize, BorshDeserialize)]
pub struct PriceFeed {
    pub price: i64,
    pub confidence: u64,
    pub exponent: i32,
    pub last_updated: i64,
}

#[derive(Debug, Clone, BorshSerialize, BorshDeserialize)]
pub struct OracleConfig {
    pub feed_id: [u8; 32],
    pub max_staleness_secs: u64,
    pub max_confidence_pct: u16,
    pub currency_pair: CurrencyPair,
}

impl OracleConfig {
    pub fn default_for(pair: CurrencyPair) -> Self {
        OracleConfig {
            feed_id: [0u8; 32],
            max_staleness_secs: 60,
            max_confidence_pct: 200, // 2.00%
            currency_pair: pair,
        }
    }
}

pub fn validate_price(
    feed: &PriceFeed,
    config: &OracleConfig,
    current_time: i64,
) -> Result<(), OracleError> {
    if feed.price <= 0 {
        return Err(OracleError::PriceNegative);
    }
    if feed.exponent > 0 || feed.exponent < -18 {
        return Err(OracleError::InvalidExponent);
    }

    let age = current_time.saturating_sub(feed.last_updated);
    if age as u64 > config.max_staleness_secs {
        return Err(OracleError::PriceStale);
    }

    // confidence as basis points of price: (confidence * 10000) / price
    let conf_bps = (feed.confidence as u128)
        .checked_mul(10_000)
        .and_then(|v| v.checked_div(feed.price as u128))
        .ok_or(OracleError::Overflow)? as u16;

    if conf_bps > config.max_confidence_pct {
        return Err(OracleError::ConfidenceTooWide);
    }

    Ok(())
}

/// Convert a fiat amount (in smallest fiat units) to token amount using the oracle price.
/// E.g., for BRL->USD stablecoin: fiat_amount in BRL centavos, returns USD-pegged tokens.
pub fn calculate_mint_amount(
    fiat_amount: u64,
    feed: &PriceFeed,
    token_decimals: u8,
) -> Result<u64, OracleError> {
    if feed.price <= 0 {
        return Err(OracleError::PriceNegative);
    }

    let exp_abs = feed.exponent.unsigned_abs();
    let price_scale = 10u128.checked_pow(exp_abs).ok_or(OracleError::Overflow)?;
    let token_scale = 10u128.checked_pow(token_decimals as u32).ok_or(OracleError::Overflow)?;

    // token_amount = fiat_amount * price * token_scale / price_scale
    let result = (fiat_amount as u128)
        .checked_mul(feed.price as u128)
        .and_then(|v| v.checked_mul(token_scale))
        .and_then(|v| v.checked_div(price_scale))
        .ok_or(OracleError::Overflow)?;

    u64::try_from(result).map_err(|_| OracleError::Overflow)
}

/// Inverse of calculate_mint_amount. Token amount -> fiat amount.
pub fn calculate_redeem_amount(
    token_amount: u64,
    feed: &PriceFeed,
    token_decimals: u8,
) -> Result<u64, OracleError> {
    if feed.price <= 0 {
        return Err(OracleError::PriceNegative);
    }

    let exp_abs = feed.exponent.unsigned_abs();
    let price_scale = 10u128.checked_pow(exp_abs).ok_or(OracleError::Overflow)?;
    let token_scale = 10u128.checked_pow(token_decimals as u32).ok_or(OracleError::Overflow)?;

    let result = (token_amount as u128)
        .checked_mul(price_scale)
        .and_then(|v| v.checked_div(feed.price as u128))
        .and_then(|v| v.checked_div(token_scale))
        .ok_or(OracleError::Overflow)?;

    u64::try_from(result).map_err(|_| OracleError::Overflow)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn usd_feed() -> PriceFeed {
        PriceFeed {
            price: 100_000_000, // $1.00 with exponent -8
            confidence: 50_000, // tight
            exponent: -8,
            last_updated: 1_700_000_000,
        }
    }

    fn brl_feed() -> PriceFeed {
        PriceFeed {
            price: 20_000_000, // $0.20 (1 BRL = 0.20 USD)
            confidence: 100_000,
            exponent: -8,
            last_updated: 1_700_000_000,
        }
    }

    fn default_config() -> OracleConfig {
        OracleConfig::default_for(CurrencyPair::UsdUsd)
    }

    #[test]
    fn valid_price_passes() {
        let feed = usd_feed();
        let config = default_config();
        assert!(validate_price(&feed, &config, 1_700_000_030).is_ok());
    }

    #[test]
    fn stale_price_rejected() {
        let feed = usd_feed();
        let config = default_config();
        // 120 seconds old, max is 60
        let result = validate_price(&feed, &config, 1_700_000_121);
        assert_eq!(result, Err(OracleError::PriceStale));
    }

    #[test]
    fn negative_price_rejected() {
        let mut feed = usd_feed();
        feed.price = -100;
        assert_eq!(
            validate_price(&feed, &default_config(), 1_700_000_000),
            Err(OracleError::PriceNegative)
        );
    }

    #[test]
    fn zero_price_rejected() {
        let mut feed = usd_feed();
        feed.price = 0;
        assert_eq!(
            validate_price(&feed, &default_config(), 1_700_000_000),
            Err(OracleError::PriceNegative)
        );
    }

    #[test]
    fn wide_confidence_rejected() {
        let mut feed = usd_feed();
        feed.confidence = 50_000_000; // 50% of price
        let config = default_config();
        assert_eq!(
            validate_price(&feed, &config, 1_700_000_000),
            Err(OracleError::ConfidenceTooWide)
        );
    }

    #[test]
    fn invalid_positive_exponent() {
        let mut feed = usd_feed();
        feed.exponent = 1;
        assert_eq!(
            validate_price(&feed, &default_config(), 1_700_000_000),
            Err(OracleError::InvalidExponent)
        );
    }

    #[test]
    fn invalid_very_negative_exponent() {
        let mut feed = usd_feed();
        feed.exponent = -19;
        assert_eq!(
            validate_price(&feed, &default_config(), 1_700_000_000),
            Err(OracleError::InvalidExponent)
        );
    }

    #[test]
    fn mint_usd_1to1() {
        let feed = usd_feed(); // price = 1.0
        // 1,000,000 fiat units -> should get 1,000,000 tokens (6 decimals)
        let result = calculate_mint_amount(1_000_000, &feed, 6).unwrap();
        assert_eq!(result, 1_000_000_000_000);
    }

    #[test]
    fn mint_brl_conversion() {
        let feed = brl_feed(); // 1 BRL = 0.20 USD
        // 1 BRL -> 0.20 USD -> 200_000 token units (6 decimals)
        let result = calculate_mint_amount(1, &feed, 6).unwrap();
        assert_eq!(result, 200_000);
    }

    #[test]
    fn mint_zero_amount() {
        let feed = usd_feed();
        let result = calculate_mint_amount(0, &feed, 6).unwrap();
        assert_eq!(result, 0);
    }

    #[test]
    fn mint_negative_price_error() {
        let mut feed = usd_feed();
        feed.price = -1;
        assert_eq!(
            calculate_mint_amount(1_000, &feed, 6),
            Err(OracleError::PriceNegative)
        );
    }

    #[test]
    fn redeem_usd_1to1() {
        let feed = usd_feed();
        let result = calculate_redeem_amount(1_000_000_000_000, &feed, 6).unwrap();
        assert_eq!(result, 1_000_000);
    }

    #[test]
    fn redeem_brl_conversion() {
        let feed = brl_feed();
        // 200_000 token units (0.20 USD) -> 1 BRL
        let result = calculate_redeem_amount(200_000, &feed, 6).unwrap();
        assert_eq!(result, 1);
    }

    #[test]
    fn redeem_zero_amount() {
        let feed = usd_feed();
        assert_eq!(calculate_redeem_amount(0, &feed, 6).unwrap(), 0);
    }

    #[test]
    fn mint_and_redeem_roundtrip() {
        let feed = brl_feed();
        let fiat = 5_000u64;
        let tokens = calculate_mint_amount(fiat, &feed, 6).unwrap();
        let back = calculate_redeem_amount(tokens, &feed, 6).unwrap();
        assert_eq!(back, fiat);
    }

    #[test]
    fn config_default_for_pairs() {
        let c1 = OracleConfig::default_for(CurrencyPair::BrlUsd);
        assert_eq!(c1.currency_pair, CurrencyPair::BrlUsd);
        assert_eq!(c1.max_staleness_secs, 60);

        let c2 = OracleConfig::default_for(CurrencyPair::EurUsd);
        assert_eq!(c2.currency_pair, CurrencyPair::EurUsd);
    }

    #[test]
    fn price_exactly_at_staleness_boundary() {
        let feed = usd_feed();
        let config = default_config();
        // Exactly 60 seconds old should still pass
        assert!(validate_price(&feed, &config, 1_700_000_060).is_ok());
    }

    #[test]
    fn price_one_second_past_staleness() {
        let feed = usd_feed();
        let config = default_config();
        assert_eq!(
            validate_price(&feed, &config, 1_700_000_061),
            Err(OracleError::PriceStale)
        );
    }

    #[test]
    fn serialization_roundtrip() {
        let feed = brl_feed();
        let encoded = borsh::to_vec(&feed).unwrap();
        let decoded = PriceFeed::try_from_slice(&encoded).unwrap();
        assert_eq!(decoded.price, feed.price);
        assert_eq!(decoded.exponent, feed.exponent);
    }
}
