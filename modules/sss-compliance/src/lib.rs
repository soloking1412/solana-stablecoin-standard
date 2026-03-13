use borsh::{BorshDeserialize, BorshSerialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, BorshSerialize, BorshDeserialize)]
#[repr(u8)]
pub enum AuditAction {
    Mint = 0,
    Burn = 1,
    Freeze = 2,
    Thaw = 3,
    Pause = 4,
    Unpause = 5,
    BlacklistAdd = 6,
    BlacklistRemove = 7,
    Seize = 8,
    RoleGranted = 9,
    RoleRevoked = 10,
    QuotaUpdated = 11,
    AuthorityTransferred = 12,
}

#[derive(Debug, Clone, PartialEq, Eq, BorshSerialize, BorshDeserialize)]
pub struct AuditEntry {
    pub action: AuditAction,
    pub actor: [u8; 32],
    pub target: [u8; 32],
    pub amount: Option<u64>,
    pub reason: Option<String>,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, BorshSerialize, BorshDeserialize)]
#[repr(u8)]
pub enum ComplianceLevel {
    /// No compliance enforcement
    None = 0,
    /// SSS-1: basic mint/burn/pause
    Basic = 1,
    /// SSS-2: adds freeze, blacklist, seize
    Full = 2,
    /// SSS-3: adds privacy-preserving audit trail
    Private = 3,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, BorshSerialize, BorshDeserialize)]
#[repr(u8)]
pub enum SanctionsScreeningResult {
    Clear = 0,
    Match = 1,
    PendingReview = 2,
}

/// Whether a given action is permitted at this compliance level.
/// Higher levels unlock more restrictive (regulated) actions.
pub fn is_compliant_action(level: &ComplianceLevel, action: &AuditAction) -> bool {
    match level {
        ComplianceLevel::None => false,
        ComplianceLevel::Basic => matches!(
            action,
            AuditAction::Mint
                | AuditAction::Burn
                | AuditAction::Pause
                | AuditAction::Unpause
                | AuditAction::RoleGranted
                | AuditAction::RoleRevoked
                | AuditAction::QuotaUpdated
                | AuditAction::AuthorityTransferred
        ),
        ComplianceLevel::Full | ComplianceLevel::Private => true,
    }
}

pub fn requires_blacklist_check(level: &ComplianceLevel) -> bool {
    matches!(level, ComplianceLevel::Full | ComplianceLevel::Private)
}

pub fn format_audit_entry(entry: &AuditEntry) -> String {
    let action_str = match entry.action {
        AuditAction::Mint => "MINT",
        AuditAction::Burn => "BURN",
        AuditAction::Freeze => "FREEZE",
        AuditAction::Thaw => "THAW",
        AuditAction::Pause => "PAUSE",
        AuditAction::Unpause => "UNPAUSE",
        AuditAction::BlacklistAdd => "BLACKLIST_ADD",
        AuditAction::BlacklistRemove => "BLACKLIST_REMOVE",
        AuditAction::Seize => "SEIZE",
        AuditAction::RoleGranted => "ROLE_GRANTED",
        AuditAction::RoleRevoked => "ROLE_REVOKED",
        AuditAction::QuotaUpdated => "QUOTA_UPDATED",
        AuditAction::AuthorityTransferred => "AUTHORITY_TRANSFERRED",
    };

    let actor_hex = hex_short(&entry.actor);
    let target_hex = hex_short(&entry.target);

    let mut out = format!(
        "[{}] {} actor={} target={}",
        entry.timestamp, action_str, actor_hex, target_hex
    );

    if let Some(amt) = entry.amount {
        out.push_str(&format!(" amount={}", amt));
    }
    if let Some(ref reason) = entry.reason {
        out.push_str(&format!(" reason=\"{}\"", reason));
    }

    out
}

/// First 4 bytes as hex for log readability.
fn hex_short(bytes: &[u8; 32]) -> String {
    format!(
        "{:02x}{:02x}{:02x}{:02x}...",
        bytes[0], bytes[1], bytes[2], bytes[3]
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_entry(action: AuditAction, amount: Option<u64>, reason: Option<&str>) -> AuditEntry {
        AuditEntry {
            action,
            actor: [0xAA; 32],
            target: [0xBB; 32],
            amount,
            reason: reason.map(String::from),
            timestamp: 1_700_000_000,
        }
    }

    // --- compliance level checks ---

    #[test]
    fn none_blocks_everything() {
        let actions = [
            AuditAction::Mint,
            AuditAction::Burn,
            AuditAction::Freeze,
            AuditAction::Seize,
        ];
        for action in &actions {
            assert!(!is_compliant_action(&ComplianceLevel::None, action));
        }
    }

    #[test]
    fn basic_allows_mint_burn_pause() {
        assert!(is_compliant_action(&ComplianceLevel::Basic, &AuditAction::Mint));
        assert!(is_compliant_action(&ComplianceLevel::Basic, &AuditAction::Burn));
        assert!(is_compliant_action(&ComplianceLevel::Basic, &AuditAction::Pause));
        assert!(is_compliant_action(&ComplianceLevel::Basic, &AuditAction::Unpause));
    }

    #[test]
    fn basic_blocks_freeze_and_seize() {
        assert!(!is_compliant_action(&ComplianceLevel::Basic, &AuditAction::Freeze));
        assert!(!is_compliant_action(&ComplianceLevel::Basic, &AuditAction::Thaw));
        assert!(!is_compliant_action(&ComplianceLevel::Basic, &AuditAction::BlacklistAdd));
        assert!(!is_compliant_action(&ComplianceLevel::Basic, &AuditAction::Seize));
    }

    #[test]
    fn full_allows_everything() {
        let actions = [
            AuditAction::Mint,
            AuditAction::Burn,
            AuditAction::Freeze,
            AuditAction::Thaw,
            AuditAction::BlacklistAdd,
            AuditAction::BlacklistRemove,
            AuditAction::Seize,
            AuditAction::Pause,
            AuditAction::Unpause,
            AuditAction::RoleGranted,
            AuditAction::RoleRevoked,
            AuditAction::QuotaUpdated,
            AuditAction::AuthorityTransferred,
        ];
        for action in &actions {
            assert!(
                is_compliant_action(&ComplianceLevel::Full, action),
                "Full should allow {:?}",
                action
            );
        }
    }

    #[test]
    fn private_allows_everything() {
        assert!(is_compliant_action(&ComplianceLevel::Private, &AuditAction::Seize));
        assert!(is_compliant_action(&ComplianceLevel::Private, &AuditAction::Freeze));
        assert!(is_compliant_action(&ComplianceLevel::Private, &AuditAction::Mint));
    }

    #[test]
    fn basic_allows_role_management() {
        assert!(is_compliant_action(&ComplianceLevel::Basic, &AuditAction::RoleGranted));
        assert!(is_compliant_action(&ComplianceLevel::Basic, &AuditAction::RoleRevoked));
        assert!(is_compliant_action(&ComplianceLevel::Basic, &AuditAction::AuthorityTransferred));
    }

    // --- blacklist check ---

    #[test]
    fn blacklist_check_required_for_full_and_private() {
        assert!(requires_blacklist_check(&ComplianceLevel::Full));
        assert!(requires_blacklist_check(&ComplianceLevel::Private));
    }

    #[test]
    fn blacklist_check_not_required_for_none_and_basic() {
        assert!(!requires_blacklist_check(&ComplianceLevel::None));
        assert!(!requires_blacklist_check(&ComplianceLevel::Basic));
    }

    // --- audit formatting ---

    #[test]
    fn format_mint_with_amount() {
        let entry = make_entry(AuditAction::Mint, Some(1_000_000), None);
        let formatted = format_audit_entry(&entry);
        assert!(formatted.contains("MINT"));
        assert!(formatted.contains("amount=1000000"));
        assert!(formatted.contains("aaaaaaaa..."));
        assert!(formatted.contains("bbbbbbbb..."));
    }

    #[test]
    fn format_seize_with_reason() {
        let entry = make_entry(AuditAction::Seize, Some(500), Some("OFAC sanctions"));
        let formatted = format_audit_entry(&entry);
        assert!(formatted.contains("SEIZE"));
        assert!(formatted.contains("amount=500"));
        assert!(formatted.contains("reason=\"OFAC sanctions\""));
    }

    #[test]
    fn format_pause_no_amount_no_reason() {
        let entry = make_entry(AuditAction::Pause, None, None);
        let formatted = format_audit_entry(&entry);
        assert!(formatted.contains("PAUSE"));
        assert!(!formatted.contains("amount="));
        assert!(!formatted.contains("reason="));
    }

    #[test]
    fn format_contains_timestamp() {
        let entry = make_entry(AuditAction::Burn, None, None);
        let formatted = format_audit_entry(&entry);
        assert!(formatted.contains("[1700000000]"));
    }

    #[test]
    fn format_all_action_names() {
        let pairs: Vec<(AuditAction, &str)> = vec![
            (AuditAction::Mint, "MINT"),
            (AuditAction::Burn, "BURN"),
            (AuditAction::Freeze, "FREEZE"),
            (AuditAction::Thaw, "THAW"),
            (AuditAction::Pause, "PAUSE"),
            (AuditAction::Unpause, "UNPAUSE"),
            (AuditAction::BlacklistAdd, "BLACKLIST_ADD"),
            (AuditAction::BlacklistRemove, "BLACKLIST_REMOVE"),
            (AuditAction::Seize, "SEIZE"),
            (AuditAction::RoleGranted, "ROLE_GRANTED"),
            (AuditAction::RoleRevoked, "ROLE_REVOKED"),
            (AuditAction::QuotaUpdated, "QUOTA_UPDATED"),
            (AuditAction::AuthorityTransferred, "AUTHORITY_TRANSFERRED"),
        ];
        for (action, expected) in pairs {
            let entry = make_entry(action, None, None);
            assert!(format_audit_entry(&entry).contains(expected));
        }
    }

    // --- serialization ---

    #[test]
    fn audit_entry_serialization_roundtrip() {
        let entry = make_entry(AuditAction::BlacklistAdd, Some(42), Some("test"));
        let encoded = borsh::to_vec(&entry).unwrap();
        let decoded = AuditEntry::try_from_slice(&encoded).unwrap();
        assert_eq!(entry, decoded);
    }

    #[test]
    fn compliance_level_serialization_roundtrip() {
        for level in [
            ComplianceLevel::None,
            ComplianceLevel::Basic,
            ComplianceLevel::Full,
            ComplianceLevel::Private,
        ] {
            let encoded = borsh::to_vec(&level).unwrap();
            let decoded = ComplianceLevel::try_from_slice(&encoded).unwrap();
            assert_eq!(level, decoded);
        }
    }

    #[test]
    fn sanctions_screening_values() {
        assert_ne!(SanctionsScreeningResult::Clear, SanctionsScreeningResult::Match);
        assert_ne!(SanctionsScreeningResult::Match, SanctionsScreeningResult::PendingReview);
    }
}
