use anchor_lang::prelude::*;

use crate::events::ConfigUpdated;
use crate::state::{Role, RoleAccount, StablecoinConfig};

/// Update (or clear) the Pyth oracle feed ID used for oracle-gated minting.
///
/// Setting `oracle_feed_id` to `Some(feed_id)` enables oracle-adjusted supply
/// caps for `mint_tokens` when a `price_update` account is provided.
/// Setting it to `None` disables oracle-adjusted minting (raw cap only).
///
/// # Security
/// Only an Admin can set this value. Operators must verify the Pyth feed ID
/// against the canonical list at https://pyth.network/price-feeds before
/// calling this instruction.
#[derive(Accounts)]
pub struct UpdateOracleFeed<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [StablecoinConfig::SSS_CONFIG_SEED, config.mint.as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// Admin role PDA — proves admin authorization.
    #[account(
        seeds = [
            RoleAccount::SSS_ROLE_SEED,
            config.key().as_ref(),
            admin.key().as_ref(),
            &[Role::Admin.as_u8()],
        ],
        bump = admin_role.bump,
    )]
    pub admin_role: Account<'info, RoleAccount>,
}

pub fn handler_update_oracle_feed(
    ctx: Context<UpdateOracleFeed>,
    oracle_feed_id: Option<[u8; 32]>,
) -> Result<()> {
    ctx.accounts.config.oracle_feed_id = oracle_feed_id;

    emit!(ConfigUpdated {
        config: ctx.accounts.config.key(),
        field: "oracle_feed_id".to_string(),
        updater: ctx.accounts.admin.key(),
    });

    Ok(())
}
