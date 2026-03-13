use anchor_lang::prelude::*;

#[error_code]
pub enum StablecoinError {
    #[msg("Token operations are currently paused")]
    Paused,

    #[msg("Token operations are not paused")]
    NotPaused,

    #[msg("Amount must be greater than zero")]
    ZeroAmount,

    #[msg("Minting would exceed the assigned quota")]
    QuotaExceeded,

    #[msg("Unauthorized: missing required role")]
    Unauthorized,

    #[msg("Role account is not active")]
    RoleInactive,

    #[msg("Invalid role type")]
    InvalidRole,

    #[msg("Compliance features are not enabled for this token")]
    ComplianceNotEnabled,

    #[msg("Address is already blacklisted")]
    AlreadyBlacklisted,

    #[msg("Address is not blacklisted")]
    NotBlacklisted,

    #[msg("Address is blacklisted and cannot transact")]
    AddressBlacklisted,

    #[msg("Cannot remove the last admin")]
    LastAdmin,

    #[msg("Name exceeds maximum length of 32 characters")]
    NameTooLong,

    #[msg("Symbol exceeds maximum length of 10 characters")]
    SymbolTooLong,

    #[msg("URI exceeds maximum length of 200 characters")]
    UriTooLong,

    #[msg("Reason exceeds maximum length of 128 characters")]
    ReasonTooLong,

    #[msg("Invalid preset value")]
    InvalidPreset,

    #[msg("Account is not frozen")]
    AccountNotFrozen,

    #[msg("Account is already frozen")]
    AccountAlreadyFrozen,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Authority mismatch")]
    AuthorityMismatch,

    #[msg("Mint mismatch")]
    MintMismatch,

    #[msg("Cannot grant compliance roles on non-compliant token")]
    ComplianceRoleNotAllowed,

    #[msg("Cannot seize from a non-frozen account")]
    AccountMustBeFrozen,

    #[msg("New authority cannot be the zero address")]
    InvalidAuthority,

    #[msg("Token account has insufficient balance for seizure")]
    InsufficientBalance,
}
