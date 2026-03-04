use anchor_lang::prelude::*;

/// Emitted when an address is added to the blacklist.
///
/// Compliance systems MUST monitor this event to maintain up-to-date
/// denylist state off-chain. The `reason` field should contain only
/// compliance reference codes — never include PII (name, SSN, etc.)
/// as this data is stored permanently on-chain.
#[event]
pub struct BlacklistAdded {
    /// The stablecoin mint this entry applies to.
    pub mint: Pubkey,
    /// The wallet address that was blacklisted.
    pub address: Pubkey,
    /// The blacklister who added this entry.
    pub added_by: Pubkey,
    /// Unix timestamp when the entry was created.
    pub added_at: i64,
    /// Compliance reason (reference code, not PII).
    pub reason: String,
}

/// Emitted when an address is removed from the blacklist.
#[event]
pub struct BlacklistRemoved {
    /// The stablecoin mint this entry applied to.
    pub mint: Pubkey,
    /// The wallet address that was removed from the blacklist.
    pub address: Pubkey,
    /// The blacklister who removed this entry.
    pub removed_by: Pubkey,
}
