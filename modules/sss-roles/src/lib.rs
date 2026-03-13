use borsh::{BorshDeserialize, BorshSerialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, BorshSerialize, BorshDeserialize)]
#[repr(u8)]
pub enum RoleType {
    Admin = 0,
    Minter = 1,
    Burner = 2,
    Freezer = 3,
    Pauser = 4,
    Blacklister = 5,
    Seizer = 6,
}

#[derive(Debug, Clone, PartialEq, Eq, BorshSerialize, BorshDeserialize)]
pub struct RoleInfo {
    pub role: RoleType,
    pub active: bool,
    pub granted_at: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Permission {
    MintTokens,
    BurnTokens,
    FreezeAccount,
    ThawAccount,
    PauseToken,
    UnpauseToken,
    ManageBlacklist,
    SeizeTokens,
    ManageRoles,
    TransferAuthority,
}

pub fn role_has_permission(role: &RoleType, permission: &Permission) -> bool {
    match role {
        RoleType::Admin => matches!(
            permission,
            Permission::ManageRoles | Permission::TransferAuthority
        ),
        RoleType::Minter => matches!(permission, Permission::MintTokens),
        RoleType::Burner => matches!(permission, Permission::BurnTokens),
        RoleType::Freezer => matches!(
            permission,
            Permission::FreezeAccount | Permission::ThawAccount
        ),
        RoleType::Pauser => matches!(
            permission,
            Permission::PauseToken | Permission::UnpauseToken
        ),
        RoleType::Blacklister => matches!(permission, Permission::ManageBlacklist),
        RoleType::Seizer => matches!(permission, Permission::SeizeTokens),
    }
}

/// Blacklister and Seizer operate under regulatory constraints.
pub fn requires_compliance(role: &RoleType) -> bool {
    matches!(role, RoleType::Blacklister | RoleType::Seizer)
}

/// Only Admin can assign or revoke roles.
pub fn validate_role_assignment(assigner_role: &RoleType, _target_role: &RoleType) -> bool {
    matches!(assigner_role, RoleType::Admin)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn admin_can_manage_roles() {
        assert!(role_has_permission(&RoleType::Admin, &Permission::ManageRoles));
    }

    #[test]
    fn admin_can_transfer_authority() {
        assert!(role_has_permission(&RoleType::Admin, &Permission::TransferAuthority));
    }

    #[test]
    fn admin_cannot_mint() {
        assert!(!role_has_permission(&RoleType::Admin, &Permission::MintTokens));
    }

    #[test]
    fn minter_can_mint() {
        assert!(role_has_permission(&RoleType::Minter, &Permission::MintTokens));
    }

    #[test]
    fn minter_cannot_burn() {
        assert!(!role_has_permission(&RoleType::Minter, &Permission::BurnTokens));
    }

    #[test]
    fn burner_can_burn() {
        assert!(role_has_permission(&RoleType::Burner, &Permission::BurnTokens));
    }

    #[test]
    fn freezer_can_freeze_and_thaw() {
        assert!(role_has_permission(&RoleType::Freezer, &Permission::FreezeAccount));
        assert!(role_has_permission(&RoleType::Freezer, &Permission::ThawAccount));
    }

    #[test]
    fn freezer_cannot_pause() {
        assert!(!role_has_permission(&RoleType::Freezer, &Permission::PauseToken));
    }

    #[test]
    fn pauser_can_pause_and_unpause() {
        assert!(role_has_permission(&RoleType::Pauser, &Permission::PauseToken));
        assert!(role_has_permission(&RoleType::Pauser, &Permission::UnpauseToken));
    }

    #[test]
    fn blacklister_can_manage_blacklist() {
        assert!(role_has_permission(&RoleType::Blacklister, &Permission::ManageBlacklist));
    }

    #[test]
    fn blacklister_cannot_seize() {
        assert!(!role_has_permission(&RoleType::Blacklister, &Permission::SeizeTokens));
    }

    #[test]
    fn seizer_can_seize() {
        assert!(role_has_permission(&RoleType::Seizer, &Permission::SeizeTokens));
    }

    #[test]
    fn compliance_required_for_blacklister_and_seizer() {
        assert!(requires_compliance(&RoleType::Blacklister));
        assert!(requires_compliance(&RoleType::Seizer));
    }

    #[test]
    fn compliance_not_required_for_other_roles() {
        assert!(!requires_compliance(&RoleType::Admin));
        assert!(!requires_compliance(&RoleType::Minter));
        assert!(!requires_compliance(&RoleType::Burner));
        assert!(!requires_compliance(&RoleType::Freezer));
        assert!(!requires_compliance(&RoleType::Pauser));
    }

    #[test]
    fn admin_can_assign_any_role() {
        assert!(validate_role_assignment(&RoleType::Admin, &RoleType::Minter));
        assert!(validate_role_assignment(&RoleType::Admin, &RoleType::Seizer));
        assert!(validate_role_assignment(&RoleType::Admin, &RoleType::Admin));
    }

    #[test]
    fn non_admin_cannot_assign_roles() {
        assert!(!validate_role_assignment(&RoleType::Minter, &RoleType::Burner));
        assert!(!validate_role_assignment(&RoleType::Seizer, &RoleType::Minter));
        assert!(!validate_role_assignment(&RoleType::Pauser, &RoleType::Admin));
    }

    #[test]
    fn role_info_serialization_roundtrip() {
        let info = RoleInfo {
            role: RoleType::Freezer,
            active: true,
            granted_at: 1_700_000_000,
        };
        let encoded = borsh::to_vec(&info).unwrap();
        let decoded = RoleInfo::try_from_slice(&encoded).unwrap();
        assert_eq!(info, decoded);
    }

    #[test]
    fn inactive_role_info() {
        let info = RoleInfo {
            role: RoleType::Minter,
            active: false,
            granted_at: 0,
        };
        assert!(!info.active);
        assert_eq!(info.role, RoleType::Minter);
    }

    #[test]
    fn each_role_has_at_least_one_permission() {
        let all_permissions = [
            Permission::MintTokens,
            Permission::BurnTokens,
            Permission::FreezeAccount,
            Permission::ThawAccount,
            Permission::PauseToken,
            Permission::UnpauseToken,
            Permission::ManageBlacklist,
            Permission::SeizeTokens,
            Permission::ManageRoles,
            Permission::TransferAuthority,
        ];
        let all_roles = [
            RoleType::Admin,
            RoleType::Minter,
            RoleType::Burner,
            RoleType::Freezer,
            RoleType::Pauser,
            RoleType::Blacklister,
            RoleType::Seizer,
        ];
        for role in &all_roles {
            let has_any = all_permissions.iter().any(|p| role_has_permission(role, p));
            assert!(has_any, "{:?} should have at least one permission", role);
        }
    }

    #[test]
    fn no_role_has_all_permissions() {
        let all_permissions = [
            Permission::MintTokens,
            Permission::BurnTokens,
            Permission::FreezeAccount,
            Permission::ThawAccount,
            Permission::PauseToken,
            Permission::UnpauseToken,
            Permission::ManageBlacklist,
            Permission::SeizeTokens,
            Permission::ManageRoles,
            Permission::TransferAuthority,
        ];
        let all_roles = [
            RoleType::Admin,
            RoleType::Minter,
            RoleType::Burner,
            RoleType::Freezer,
            RoleType::Pauser,
            RoleType::Blacklister,
            RoleType::Seizer,
        ];
        for role in &all_roles {
            let has_all = all_permissions.iter().all(|p| role_has_permission(role, p));
            assert!(!has_all, "{:?} should not have every permission", role);
        }
    }
}
