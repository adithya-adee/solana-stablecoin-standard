use anchor_lang::prelude::*;

#[account]
pub struct BlacklistEntry {
    /// The stablecoin mint this entry applies to.
    pub mint: Pubkey,
    /// The wallet address that is blacklisted.
    pub address: Pubkey,
    /// The admin who added this entry.
    pub added_by: Pubkey,
    /// Unix timestamp when the entry was created.
    pub added_at: i64,
    /// Compliance reason for blacklisting (max 512 chars).
    pub reason: String,
    /// PDA bump seed.
    pub bump: u8,
}

impl BlacklistEntry {
    pub const BLACKLIST_SEED: &[u8] = b"blacklist";
    /// BlacklistEntry account space:
    /// discriminator(8) + mint(32) + address(32) + added_by(32)
    /// + added_at(8) + reason string(4 + 512) + bump(1) = 629
    pub const BLACKLIST_SPACE: usize = 629;
}
