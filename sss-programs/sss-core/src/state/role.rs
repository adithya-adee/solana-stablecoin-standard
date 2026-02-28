use anchor_lang::prelude::*;

#[account]
pub struct RoleAccount {
    pub config: Pubkey,
    pub address: Pubkey,
    pub role: Role,
    pub granted_by: Pubkey,
    pub granted_at: i64,
    pub bump: u8,
    /// Per-minter quota: maximum amount this minter is allowed to mint.
    /// None means unlimited. Only meaningful for Role::Minter.
    pub mint_quota: Option<u64>,
    /// Cumulative amount minted by this minter. Only tracked for Role::Minter.
    pub amount_minted: u64,
}

impl RoleAccount {
    pub const SSS_ROLE_SEED: &[u8] = b"sss-role";

    pub const ROLE_SPACE: usize = 8 + // discriminator
        32 + // config
        32 + // address
        1 +  // role
        32 + // granted_by
        8 +  // granted_at
        1 +  // bump
        9 +  // Option<u64> mint_quota (1 + 8)
        8; // amount_minted
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Role {
    Admin,
    Minter,
    Freezer,
    Pauser,
    Burner,
    Blacklister,
    Seizer,
}

impl Role {
    pub fn as_u8(&self) -> u8 {
        match self {
            Role::Admin => 0,
            Role::Minter => 1,
            Role::Freezer => 2,
            Role::Pauser => 3,
            Role::Burner => 4,
            Role::Blacklister => 5,
            Role::Seizer => 6,
        }
    }
}
