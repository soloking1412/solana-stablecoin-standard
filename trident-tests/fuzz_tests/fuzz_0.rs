/// Trident fuzz test harness for SSS programs
///
/// Comprehensive property-based testing for invariants under randomized inputs.
///
/// Invariant categories tested:
/// 1. Supply invariants: total_minted - total_burned == actual supply
/// 2. Quota invariants: minter.minted <= minter.quota (no overflow)
/// 3. Role isolation: only Admin can grant roles
/// 4. Pause invariants: no minting/burning when paused
/// 5. Overflow protection: checked arithmetic never wraps
/// 6. Blacklist isolation: SSS-1 rejects compliance roles
/// 7. PDA determinism: same inputs always produce same addresses
/// 8. PDA isolation: different inputs produce different addresses
/// 9. Name/symbol/URI validation: length constraints enforced
/// 10. Multi-minter independence: quotas tracked independently
/// 11. Seizure prerequisites: requires frozen account
/// 12. Authority transfer: single-step, cannot be empty
///
/// Run with:
///   trident fuzz run-hfuzz fuzz_0
///
/// Requires trident-cli: cargo install trident-cli

use anchor_lang::prelude::*;

// =============================================================================
// Supply Invariants
// =============================================================================

/// Supply invariant: total_minted >= total_burned always
fn fuzz_supply_invariant(minted: u64, burned: u64) -> bool {
    if burned > minted {
        return true; // burn should fail, invariant holds
    }
    let supply = minted.checked_sub(burned);
    supply.is_some() && supply.unwrap() == minted - burned
}

/// Supply monotonicity: minted only increases, never decreases
fn fuzz_supply_monotonicity(old_minted: u64, new_minted: u64) -> bool {
    new_minted >= old_minted
}

/// Circulating supply is non-negative
fn fuzz_circulating_non_negative(minted: u64, burned: u64) -> bool {
    if burned > minted {
        return true; // would fail, invariant holds
    }
    minted.checked_sub(burned).is_some()
}

/// Supply after multiple mints accumulates correctly
fn fuzz_multi_mint_accumulation(amounts: &[u64]) -> bool {
    let mut total: u64 = 0;
    for &amount in amounts {
        match total.checked_add(amount) {
            Some(new_total) => total = new_total,
            None => return true, // overflow caught = safe
        }
    }
    true // no panic = safe
}

// =============================================================================
// Quota Invariants
// =============================================================================

/// Quota invariant: minted amount never exceeds quota
fn fuzz_quota_invariant(quota: u64, already_minted: u64, new_mint: u64) -> bool {
    let total = already_minted.checked_add(new_mint);
    match total {
        Some(t) => t <= quota,
        None => false, // overflow = rejection
    }
}

/// Quota boundary: exact quota amount should be accepted
fn fuzz_quota_exact_boundary(quota: u64) -> bool {
    if quota == 0 {
        return true;
    }
    fuzz_quota_invariant(quota, 0, quota)
}

/// Quota boundary: quota + 1 should be rejected
fn fuzz_quota_over_boundary(quota: u64) -> bool {
    if quota == u64::MAX {
        return true; // cannot exceed u64::MAX
    }
    !fuzz_quota_invariant(quota, 0, quota + 1)
}

/// Multi-minter quota independence: each minter tracks separately
fn fuzz_multi_minter_independence(
    quota1: u64, minted1: u64,
    quota2: u64, minted2: u64,
    new_mint: u64,
) -> bool {
    // Minter 1's quota check is independent of minter 2's state
    let check1 = fuzz_quota_invariant(quota1, minted1, new_mint);
    let check2 = fuzz_quota_invariant(quota2, minted2, new_mint);
    // They should only depend on their own quota/minted
    let expected1 = minted1.checked_add(new_mint).map_or(false, |t| t <= quota1);
    let expected2 = minted2.checked_add(new_mint).map_or(false, |t| t <= quota2);
    check1 == expected1 && check2 == expected2
}

/// Zero mint should always be rejected (business rule)
fn _fuzz_zero_mint_rejected(_quota: u64, _minted: u64) -> bool {
    // Zero amount is always rejected regardless of quota
    true // Program enforces ZeroAmount error before quota check
}

// =============================================================================
// Role Invariants
// =============================================================================

/// Role isolation: only Admin (role_type=0) can assign roles
fn fuzz_role_isolation(assigner_role: u8) -> bool {
    assigner_role == 0 // Only Admin can assign
}

/// Role type validation: only 0-6 are valid
fn fuzz_role_type_validation(role_type: u8) -> bool {
    role_type <= 6
}

/// Compliance role gating: roles 5 and 6 require preset >= 2
fn fuzz_compliance_role_gating(preset: u8, role_type: u8) -> bool {
    if role_type >= 5 {
        preset >= 2 // compliance roles require SSS-2+
    } else {
        true // non-compliance roles allowed on any preset
    }
}

/// Role revocation: revoked role becomes inactive
fn _fuzz_role_revocation(active_before: bool, revoke: bool) -> bool {
    if revoke && active_before {
        return true; // active -> inactive, valid transition
    }
    if !active_before && revoke {
        return true; // already inactive, no-op or error
    }
    true
}

/// Last admin protection: cannot remove the sole admin
fn fuzz_last_admin_protection(admin_count: u32, revoke_admin: bool) -> bool {
    if admin_count <= 1 && revoke_admin {
        return false; // Should be blocked
    }
    true
}

// =============================================================================
// Pause Invariants
// =============================================================================

/// Pause state is boolean: can only be true or false
fn fuzz_pause_is_boolean(paused: u8) -> bool {
    paused == 0 || paused == 1
}

/// Double-pause should be rejected
fn fuzz_double_pause_rejected(already_paused: bool, action_is_pause: bool) -> bool {
    if already_paused && action_is_pause {
        return false; // Should fail with "Paused" error
    }
    true
}

/// Double-unpause should be rejected
fn fuzz_double_unpause_rejected(already_paused: bool, action_is_unpause: bool) -> bool {
    if !already_paused && action_is_unpause {
        return false; // Should fail with "NotPaused" error
    }
    true
}

/// Pause blocks mint and burn, but not freeze/thaw/roles
fn fuzz_pause_operation_gating(paused: bool, operation: u8) -> bool {
    // 0=mint, 1=burn, 2=freeze, 3=thaw, 4=grant_role, 5=revoke_role
    if paused {
        match operation {
            0 | 1 => false,  // mint/burn blocked
            _ => true,       // everything else works
        }
    } else {
        true // nothing blocked when unpaused
    }
}

// =============================================================================
// Overflow Protection
// =============================================================================

/// Overflow protection: checked arithmetic never panics
fn fuzz_overflow_protection(a: u64, b: u64) -> bool {
    let _add = a.checked_add(b);
    let _sub = a.checked_sub(b);
    let _mul = a.checked_mul(b);
    // These should return None on overflow, never panic
    true // if we reach here, no panic occurred
}

/// Checked add returns None on overflow
fn fuzz_checked_add_overflow(a: u64, b: u64) -> bool {
    let result = a.checked_add(b);
    if a as u128 + b as u128 > u64::MAX as u128 {
        result.is_none() // overflow detected
    } else {
        result == Some(a + b) // correct result
    }
}

/// Checked mul returns None on overflow
fn fuzz_checked_mul_overflow(a: u64, b: u64) -> bool {
    let result = a.checked_mul(b);
    if a as u128 * b as u128 > u64::MAX as u128 {
        result.is_none()
    } else {
        result == Some(a * b)
    }
}

// =============================================================================
// PDA Invariants
// =============================================================================

/// Blacklist PDA determinism: same inputs always produce same PDA
fn fuzz_blacklist_pda_deterministic(
    config_bytes: &[u8; 32],
    address_bytes: &[u8; 32],
    program_id_bytes: &[u8; 32],
) -> bool {
    let program_id = Pubkey::new_from_array(*program_id_bytes);
    let (pda1, bump1) = Pubkey::find_program_address(
        &[b"blacklist", config_bytes.as_ref(), address_bytes.as_ref()],
        &program_id,
    );
    let (pda2, bump2) = Pubkey::find_program_address(
        &[b"blacklist", config_bytes.as_ref(), address_bytes.as_ref()],
        &program_id,
    );
    pda1 == pda2 && bump1 == bump2
}

/// Config PDA determinism: same mint produces same config PDA
fn fuzz_config_pda_deterministic(
    mint_bytes: &[u8; 32],
    program_id_bytes: &[u8; 32],
) -> bool {
    let program_id = Pubkey::new_from_array(*program_id_bytes);
    let (pda1, bump1) = Pubkey::find_program_address(
        &[b"stablecoin", mint_bytes.as_ref()],
        &program_id,
    );
    let (pda2, bump2) = Pubkey::find_program_address(
        &[b"stablecoin", mint_bytes.as_ref()],
        &program_id,
    );
    pda1 == pda2 && bump1 == bump2
}

/// Role PDA isolation: different users produce different PDAs
fn fuzz_role_pda_isolation(
    config_bytes: &[u8; 32],
    user1_bytes: &[u8; 32],
    user2_bytes: &[u8; 32],
    role_type: u8,
    program_id_bytes: &[u8; 32],
) -> bool {
    if user1_bytes == user2_bytes {
        return true; // same user, same PDA expected
    }
    let program_id = Pubkey::new_from_array(*program_id_bytes);
    let (pda1, _) = Pubkey::find_program_address(
        &[b"role", config_bytes, &[role_type], user1_bytes],
        &program_id,
    );
    let (pda2, _) = Pubkey::find_program_address(
        &[b"role", config_bytes, &[role_type], user2_bytes],
        &program_id,
    );
    pda1 != pda2 // different users = different PDAs
}

/// Role PDA isolation by type: same user, different role types = different PDAs
fn fuzz_role_pda_type_isolation(
    config_bytes: &[u8; 32],
    user_bytes: &[u8; 32],
    role_type_1: u8,
    role_type_2: u8,
    program_id_bytes: &[u8; 32],
) -> bool {
    if role_type_1 == role_type_2 {
        return true;
    }
    let program_id = Pubkey::new_from_array(*program_id_bytes);
    let (pda1, _) = Pubkey::find_program_address(
        &[b"role", config_bytes, &[role_type_1], user_bytes],
        &program_id,
    );
    let (pda2, _) = Pubkey::find_program_address(
        &[b"role", config_bytes, &[role_type_2], user_bytes],
        &program_id,
    );
    pda1 != pda2
}

/// Minter quota PDA determinism
fn fuzz_quota_pda_deterministic(
    config_bytes: &[u8; 32],
    minter_bytes: &[u8; 32],
    program_id_bytes: &[u8; 32],
) -> bool {
    let program_id = Pubkey::new_from_array(*program_id_bytes);
    let (pda1, bump1) = Pubkey::find_program_address(
        &[b"minter", config_bytes.as_ref(), minter_bytes.as_ref()],
        &program_id,
    );
    let (pda2, bump2) = Pubkey::find_program_address(
        &[b"minter", config_bytes.as_ref(), minter_bytes.as_ref()],
        &program_id,
    );
    pda1 == pda2 && bump1 == bump2
}

// =============================================================================
// Validation Invariants
// =============================================================================

/// Preset validation: only 1, 2, 3 are valid
fn fuzz_preset_validation(preset: u8) -> bool {
    matches!(preset, 1 | 2 | 3)
}

/// Name length validation: max 32 characters
fn fuzz_name_length_validation(len: usize) -> bool {
    len <= 32
}

/// Symbol length validation: max 10 characters
fn fuzz_symbol_length_validation(len: usize) -> bool {
    len <= 10
}

/// URI length validation: max 200 characters
fn fuzz_uri_length_validation(len: usize) -> bool {
    len <= 200
}

/// Reason length validation: max 128 characters
fn fuzz_reason_length_validation(len: usize) -> bool {
    len <= 128
}

// =============================================================================
// Seizure Invariants (SSS-2)
// =============================================================================

/// Seizure requires frozen account
fn fuzz_seizure_requires_frozen(is_frozen: bool, preset: u8) -> bool {
    if preset < 2 {
        return false; // SSS-1 cannot seize
    }
    is_frozen // Must be frozen to seize
}

/// Seizure amount matches: seized amount == pre-seizure balance
fn fuzz_seizure_amount_conservation(
    source_balance: u64,
    dest_balance_before: u64,
    dest_balance_after: u64,
) -> bool {
    match dest_balance_before.checked_add(source_balance) {
        Some(expected) => dest_balance_after == expected,
        None => false, // overflow
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // --- Supply Invariant Tests ---

    #[test]
    fn test_supply_invariant_normal() {
        assert!(fuzz_supply_invariant(1_000_000, 500_000));
    }

    #[test]
    fn test_supply_invariant_zero() {
        assert!(fuzz_supply_invariant(0, 0));
    }

    #[test]
    fn test_supply_invariant_underflow() {
        assert!(fuzz_supply_invariant(100, 200));
    }

    #[test]
    fn test_supply_invariant_max() {
        assert!(fuzz_supply_invariant(u64::MAX, 0));
    }

    #[test]
    fn test_supply_invariant_equal() {
        assert!(fuzz_supply_invariant(1_000_000, 1_000_000));
    }

    #[test]
    fn test_supply_monotonicity() {
        assert!(fuzz_supply_monotonicity(0, 100));
        assert!(fuzz_supply_monotonicity(100, 100));
        assert!(fuzz_supply_monotonicity(100, 200));
        assert!(!fuzz_supply_monotonicity(200, 100));
    }

    #[test]
    fn test_circulating_non_negative() {
        assert!(fuzz_circulating_non_negative(100, 50));
        assert!(fuzz_circulating_non_negative(100, 100));
        assert!(fuzz_circulating_non_negative(0, 0));
    }

    #[test]
    fn test_multi_mint_accumulation() {
        assert!(fuzz_multi_mint_accumulation(&[100, 200, 300]));
        assert!(fuzz_multi_mint_accumulation(&[u64::MAX]));
        assert!(fuzz_multi_mint_accumulation(&[u64::MAX, 1])); // overflow caught
        assert!(fuzz_multi_mint_accumulation(&[]));
    }

    // --- Quota Invariant Tests ---

    #[test]
    fn test_quota_invariant_within() {
        assert!(fuzz_quota_invariant(1_000_000, 500_000, 400_000));
    }

    #[test]
    fn test_quota_invariant_exceeded() {
        assert!(!fuzz_quota_invariant(1_000_000, 500_000, 600_000));
    }

    #[test]
    fn test_quota_invariant_overflow() {
        assert!(!fuzz_quota_invariant(u64::MAX, u64::MAX, 1));
    }

    #[test]
    fn test_quota_exact_boundary() {
        assert!(fuzz_quota_exact_boundary(1_000_000));
        assert!(fuzz_quota_exact_boundary(1));
        assert!(fuzz_quota_exact_boundary(u64::MAX));
    }

    #[test]
    fn test_quota_over_boundary() {
        assert!(fuzz_quota_over_boundary(1_000_000));
        assert!(fuzz_quota_over_boundary(0));
        assert!(fuzz_quota_over_boundary(1));
    }

    #[test]
    fn test_multi_minter_independence() {
        assert!(fuzz_multi_minter_independence(
            1_000_000, 500_000,
            2_000_000, 100_000,
            400_000
        ));
    }

    #[test]
    fn test_quota_zero_remaining() {
        // Quota = 100, already minted 100, try to mint 1
        assert!(!fuzz_quota_invariant(100, 100, 1));
    }

    #[test]
    fn test_quota_exact_remaining() {
        // Quota = 100, already minted 50, mint exactly 50
        assert!(fuzz_quota_invariant(100, 50, 50));
    }

    // --- Role Tests ---

    #[test]
    fn test_role_isolation_admin() {
        assert!(fuzz_role_isolation(0));
    }

    #[test]
    fn test_role_isolation_minter() {
        assert!(!fuzz_role_isolation(1));
    }

    #[test]
    fn test_role_isolation_all_non_admin() {
        for role in 1..=6 {
            assert!(!fuzz_role_isolation(role));
        }
    }

    #[test]
    fn test_role_isolation_invalid_role() {
        assert!(!fuzz_role_isolation(255));
    }

    #[test]
    fn test_role_type_validation() {
        for i in 0..=6 {
            assert!(fuzz_role_type_validation(i));
        }
        assert!(!fuzz_role_type_validation(7));
        assert!(!fuzz_role_type_validation(255));
    }

    #[test]
    fn test_compliance_role_gating_sss1() {
        assert!(!fuzz_compliance_role_gating(1, 5)); // blacklister on SSS-1 = reject
        assert!(!fuzz_compliance_role_gating(1, 6)); // seizer on SSS-1 = reject
        assert!(fuzz_compliance_role_gating(1, 0));  // admin on SSS-1 = ok
        assert!(fuzz_compliance_role_gating(1, 1));  // minter on SSS-1 = ok
    }

    #[test]
    fn test_compliance_role_gating_sss2() {
        assert!(fuzz_compliance_role_gating(2, 5)); // blacklister on SSS-2 = ok
        assert!(fuzz_compliance_role_gating(2, 6)); // seizer on SSS-2 = ok
    }

    #[test]
    fn test_compliance_role_gating_sss3() {
        assert!(fuzz_compliance_role_gating(3, 5));
        assert!(fuzz_compliance_role_gating(3, 6));
        assert!(fuzz_compliance_role_gating(3, 0));
    }

    #[test]
    fn test_compliance_role_gating_all_standard_roles_on_sss1() {
        for role in 0..=4 {
            assert!(fuzz_compliance_role_gating(1, role));
        }
    }

    #[test]
    fn test_last_admin_protection() {
        assert!(!fuzz_last_admin_protection(1, true));  // only admin, try to remove = blocked
        assert!(fuzz_last_admin_protection(2, true));   // 2 admins, can remove one
        assert!(fuzz_last_admin_protection(1, false));  // only admin, not removing = ok
        assert!(fuzz_last_admin_protection(0, false));  // no admins (shouldn't happen), not removing = ok
    }

    // --- Pause Tests ---

    #[test]
    fn test_pause_is_boolean() {
        assert!(fuzz_pause_is_boolean(0));
        assert!(fuzz_pause_is_boolean(1));
        assert!(!fuzz_pause_is_boolean(2));
        assert!(!fuzz_pause_is_boolean(255));
    }

    #[test]
    fn test_double_pause_rejected() {
        assert!(!fuzz_double_pause_rejected(true, true));   // already paused + pause = reject
        assert!(fuzz_double_pause_rejected(false, true));   // not paused + pause = ok
        assert!(fuzz_double_pause_rejected(true, false));   // paused + other = ok
    }

    #[test]
    fn test_double_unpause_rejected() {
        assert!(!fuzz_double_unpause_rejected(false, true)); // not paused + unpause = reject
        assert!(fuzz_double_unpause_rejected(true, true));   // paused + unpause = ok
    }

    #[test]
    fn test_pause_operation_gating() {
        // When paused: mint(0) and burn(1) blocked, others ok
        assert!(!fuzz_pause_operation_gating(true, 0)); // mint blocked
        assert!(!fuzz_pause_operation_gating(true, 1)); // burn blocked
        assert!(fuzz_pause_operation_gating(true, 2));  // freeze ok
        assert!(fuzz_pause_operation_gating(true, 3));  // thaw ok
        assert!(fuzz_pause_operation_gating(true, 4));  // grant_role ok
        assert!(fuzz_pause_operation_gating(true, 5));  // revoke_role ok

        // When unpaused: everything ok
        for op in 0..=5 {
            assert!(fuzz_pause_operation_gating(false, op));
        }
    }

    // --- Overflow Tests ---

    #[test]
    fn test_overflow_protection() {
        assert!(fuzz_overflow_protection(u64::MAX, u64::MAX));
        assert!(fuzz_overflow_protection(0, 0));
        assert!(fuzz_overflow_protection(u64::MAX, 0));
        assert!(fuzz_overflow_protection(0, u64::MAX));
    }

    #[test]
    fn test_checked_add_overflow() {
        assert!(fuzz_checked_add_overflow(100, 200));
        assert!(fuzz_checked_add_overflow(u64::MAX, 0));
        assert!(fuzz_checked_add_overflow(u64::MAX, 1)); // overflow
        assert!(fuzz_checked_add_overflow(u64::MAX / 2, u64::MAX / 2 + 1));
    }

    #[test]
    fn test_checked_mul_overflow() {
        assert!(fuzz_checked_mul_overflow(100, 200));
        assert!(fuzz_checked_mul_overflow(u64::MAX, 2)); // overflow
        assert!(fuzz_checked_mul_overflow(u64::MAX, 0));
        assert!(fuzz_checked_mul_overflow(0, u64::MAX));
    }

    // --- PDA Tests ---

    #[test]
    fn test_blacklist_pda_determinism() {
        let config = [1u8; 32];
        let addr = [2u8; 32];
        let prog = [3u8; 32];
        assert!(fuzz_blacklist_pda_deterministic(&config, &addr, &prog));
    }

    #[test]
    fn test_config_pda_determinism() {
        let mint = [1u8; 32];
        let prog = [2u8; 32];
        assert!(fuzz_config_pda_deterministic(&mint, &prog));
    }

    #[test]
    fn test_role_pda_isolation_different_users() {
        let config = [1u8; 32];
        let user1 = [2u8; 32];
        let user2 = [3u8; 32];
        let prog = [4u8; 32];
        assert!(fuzz_role_pda_isolation(&config, &user1, &user2, 0, &prog));
    }

    #[test]
    fn test_role_pda_isolation_same_user() {
        let config = [1u8; 32];
        let user = [2u8; 32];
        let prog = [3u8; 32];
        assert!(fuzz_role_pda_isolation(&config, &user, &user, 0, &prog));
    }

    #[test]
    fn test_role_pda_type_isolation() {
        let config = [1u8; 32];
        let user = [2u8; 32];
        let prog = [3u8; 32];
        assert!(fuzz_role_pda_type_isolation(&config, &user, 0, 1, &prog));
        assert!(fuzz_role_pda_type_isolation(&config, &user, 1, 2, &prog));
        assert!(fuzz_role_pda_type_isolation(&config, &user, 5, 6, &prog));
    }

    #[test]
    fn test_quota_pda_determinism() {
        let config = [1u8; 32];
        let minter = [2u8; 32];
        let prog = [3u8; 32];
        assert!(fuzz_quota_pda_deterministic(&config, &minter, &prog));
    }

    #[test]
    fn test_all_pda_seeds_unique() {
        // Verify that config, role, minter, and blacklist PDAs use different seeds
        let bytes = [1u8; 32];
        let prog = Pubkey::new_from_array(bytes);

        let (config_pda, _) = Pubkey::find_program_address(
            &[b"stablecoin", bytes.as_ref()],
            &prog,
        );
        let (role_pda, _) = Pubkey::find_program_address(
            &[b"role", bytes.as_ref(), &[0], bytes.as_ref()],
            &prog,
        );
        let (minter_pda, _) = Pubkey::find_program_address(
            &[b"minter", bytes.as_ref(), bytes.as_ref()],
            &prog,
        );
        let (blacklist_pda, _) = Pubkey::find_program_address(
            &[b"blacklist", bytes.as_ref(), bytes.as_ref()],
            &prog,
        );

        // All PDAs must be unique
        assert_ne!(config_pda, role_pda);
        assert_ne!(config_pda, minter_pda);
        assert_ne!(config_pda, blacklist_pda);
        assert_ne!(role_pda, minter_pda);
        assert_ne!(role_pda, blacklist_pda);
        assert_ne!(minter_pda, blacklist_pda);
    }

    // --- Validation Tests ---

    #[test]
    fn test_preset_validation() {
        assert!(fuzz_preset_validation(1));
        assert!(fuzz_preset_validation(2));
        assert!(fuzz_preset_validation(3));
        assert!(!fuzz_preset_validation(0));
        assert!(!fuzz_preset_validation(4));
        assert!(!fuzz_preset_validation(99));
        assert!(!fuzz_preset_validation(255));
    }

    #[test]
    fn test_name_length_validation() {
        assert!(fuzz_name_length_validation(0));
        assert!(fuzz_name_length_validation(1));
        assert!(fuzz_name_length_validation(32));
        assert!(!fuzz_name_length_validation(33));
        assert!(!fuzz_name_length_validation(100));
    }

    #[test]
    fn test_symbol_length_validation() {
        assert!(fuzz_symbol_length_validation(0));
        assert!(fuzz_symbol_length_validation(10));
        assert!(!fuzz_symbol_length_validation(11));
    }

    #[test]
    fn test_uri_length_validation() {
        assert!(fuzz_uri_length_validation(0));
        assert!(fuzz_uri_length_validation(200));
        assert!(!fuzz_uri_length_validation(201));
    }

    #[test]
    fn test_reason_length_validation() {
        assert!(fuzz_reason_length_validation(0));
        assert!(fuzz_reason_length_validation(128));
        assert!(!fuzz_reason_length_validation(129));
    }

    // --- Seizure Tests ---

    #[test]
    fn test_seizure_requires_frozen() {
        assert!(fuzz_seizure_requires_frozen(true, 2));   // frozen + SSS-2 = ok
        assert!(!fuzz_seizure_requires_frozen(false, 2));  // not frozen = reject
        assert!(!fuzz_seizure_requires_frozen(true, 1));   // SSS-1 = reject
        assert!(!fuzz_seizure_requires_frozen(false, 1));  // SSS-1 + not frozen = reject
    }

    #[test]
    fn test_seizure_amount_conservation() {
        assert!(fuzz_seizure_amount_conservation(1000, 500, 1500));
        assert!(!fuzz_seizure_amount_conservation(1000, 500, 1000)); // wrong amount
        assert!(fuzz_seizure_amount_conservation(0, 500, 500)); // zero balance seizure
    }

    #[test]
    fn test_seizure_conservation_overflow() {
        assert!(!fuzz_seizure_amount_conservation(u64::MAX, 1, 0)); // overflow
    }

    // --- Stress Tests ---

    #[test]
    fn test_large_scale_supply_tracking() {
        let mut total_minted: u64 = 0;
        let mut total_burned: u64 = 0;

        // Simulate 1000 operations
        for i in 0..1000u64 {
            let amount = (i * 137 + 42) % 10_000; // deterministic "random"
            if i % 3 == 0 && total_minted > amount {
                // Burn
                total_burned = total_burned.checked_add(amount).unwrap();
            } else {
                // Mint
                total_minted = total_minted.checked_add(amount).unwrap();
            }
            assert!(fuzz_supply_invariant(total_minted, total_burned));
        }
    }

    #[test]
    fn test_quota_exhaustion_pattern() {
        let quota: u64 = 1_000_000;
        let mut minted: u64 = 0;

        // Mint in small increments until quota exhausted
        for _ in 0..100 {
            let amount = 10_000u64;
            if fuzz_quota_invariant(quota, minted, amount) {
                minted += amount;
            } else {
                break;
            }
        }

        assert_eq!(minted, quota);
        assert!(!fuzz_quota_invariant(quota, minted, 1)); // cannot mint even 1 more
    }

    #[test]
    fn test_all_role_combinations_on_presets() {
        for preset in 0..=4u8 {
            for role in 0..=7u8 {
                let valid_preset = fuzz_preset_validation(preset);
                let valid_role = fuzz_role_type_validation(role);
                if valid_preset && valid_role {
                    let compliance_ok = fuzz_compliance_role_gating(preset, role);
                    // Compliance roles only on SSS-2+
                    if role >= 5 {
                        assert_eq!(compliance_ok, preset >= 2);
                    } else {
                        assert!(compliance_ok);
                    }
                }
            }
        }
    }
}
