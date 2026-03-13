pub const STABLECOIN_SEED: &[u8] = b"stablecoin";
pub const ROLE_SEED: &[u8] = b"role";
pub const MINTER_SEED: &[u8] = b"minter";
pub const BLACKLIST_SEED: &[u8] = b"blacklist";
pub const EXTRA_METAS_SEED: &[u8] = b"extra-account-metas";

pub const MAX_NAME_LEN: usize = 32;
pub const MAX_SYMBOL_LEN: usize = 10;
pub const MAX_URI_LEN: usize = 200;
pub const MAX_REASON_LEN: usize = 128;
pub const RESERVED_SPACE: usize = 64;

pub const PRESET_SSS1: u8 = 1;
pub const PRESET_SSS2: u8 = 2;
pub const PRESET_SSS3: u8 = 3;

#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum RoleType {
    Admin = 0,
    Minter = 1,
    Burner = 2,
    Freezer = 3,
    Pauser = 4,
    Blacklister = 5,
    Seizer = 6,
}

impl RoleType {
    pub fn from_u8(val: u8) -> Option<Self> {
        match val {
            0 => Some(RoleType::Admin),
            1 => Some(RoleType::Minter),
            2 => Some(RoleType::Burner),
            3 => Some(RoleType::Freezer),
            4 => Some(RoleType::Pauser),
            5 => Some(RoleType::Blacklister),
            6 => Some(RoleType::Seizer),
            _ => None,
        }
    }

    pub fn requires_compliance(&self) -> bool {
        matches!(self, RoleType::Blacklister | RoleType::Seizer)
    }
}
