use anchor_lang::prelude::*;

use crate::constants::MAX_REASON_LEN;
use crate::error::TransferHookError;
use crate::state::BlacklistEntry;

use super::admin_verify::verify_blacklister_for_mint;

#[derive(Accounts)]
#[instruction(reason: String)]
pub struct AddToBlacklist<'info> {
    #[account(mut)]
    pub blacklister: Signer<'info>,

    /// CHECK: The sss-core RoleAccount PDA proving the authority has Blacklister role.
    /// Verified by checking owner == sss-core program ID and re-deriving the
    /// expected PDA address from known seeds using the mint key.
    pub blacklister_role: UncheckedAccount<'info>,

    /// CHECK: The stablecoin mint this blacklist entry applies to.
    pub mint: UncheckedAccount<'info>,

    /// CHECK: The wallet address to blacklist. Any valid public key.
    pub address: UncheckedAccount<'info>,

    #[account(
    init,
    payer = blacklister,
    space = 8 + 32 + 32 + 32 + 8 + (4 + reason.len()) + 1,
    seeds = [BlacklistEntry::BLACKLIST_SEED, mint.key().as_ref(), address.key().as_ref()],
    bump,
  )]
    pub blacklist_entry: Account<'info, BlacklistEntry>,

    pub system_program: Program<'info, System>,
}

pub fn handler_add_to_blacklist(ctx: Context<AddToBlacklist>, reason: String) -> Result<()> {
    // Validate reason length.
    require!(
        reason.len() <= MAX_REASON_LEN,
        TransferHookError::ReasonTooLong
    );

    // Verify the caller has Blacklister role in sss-core for this mint.
    verify_blacklister_for_mint(
        &ctx.accounts.blacklister_role.to_account_info(),
        &ctx.accounts.mint.key(),
        &ctx.accounts.blacklister.key(),
    )?;

    let entry = &mut ctx.accounts.blacklist_entry;
    entry.mint = ctx.accounts.mint.key();
    entry.address = ctx.accounts.address.key();
    entry.added_by = ctx.accounts.blacklister.key();
    entry.added_at = Clock::get()?.unix_timestamp;
    entry.reason = reason;
    entry.bump = ctx.bumps.blacklist_entry;

    Ok(())
}
