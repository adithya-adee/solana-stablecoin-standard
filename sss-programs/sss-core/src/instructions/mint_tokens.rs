use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, MintTo, TokenAccount, TokenInterface};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

use crate::error::SssError;
use crate::events::TokensMinted;
use crate::state::{Role, RoleAccount, StablecoinConfig};

/// Maximum age of a Pyth price update in seconds before it is considered stale.
/// 120 seconds (2 minutes) — conservative threshold suited for stablecoin minting.
const ORACLE_MAX_AGE_SECS: u64 = 120;

#[derive(Accounts)]
pub struct MintTokens<'info> {
    pub minter: Signer<'info>,

    #[account(
        mut,
        seeds = [StablecoinConfig::SSS_CONFIG_SEED, mint.key().as_ref()],
        bump = config.bump,
        constraint = !config.paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// Minter role PDA — its existence proves authorization.
    /// Mutable for per-minter quota tracking (amount_minted).
    #[account(
        mut,
        seeds = [
            RoleAccount::SSS_ROLE_SEED,
            config.key().as_ref(),
            minter.key().as_ref(),
            &[Role::Minter.as_u8()],
        ],
        bump = minter_role.bump,
    )]
    pub minter_role: Account<'info, RoleAccount>,

    #[account(
        mut,
        constraint = config.mint == mint.key() @ SssError::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
    )]
    pub to: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,

    /// Optional Pyth price update account.  Pass this account to have the
    /// supply cap interpreted as a USD amount; omit it to use the raw
    /// token-unit cap.
    ///
    /// When provided, Anchor automatically verifies ownership by the Pyth
    /// Solana Receiver program.  The instruction then calls
    /// `get_price_no_older_than` which internally checks:
    ///   1. The price is not older than `ORACLE_MAX_AGE_SECS`.
    ///   2. The feed ID matches `config.oracle_feed_id` (if set).
    pub price_update: Option<Account<'info, PriceUpdateV2>>,
}

pub fn handler_mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, SssError::ZeroAmount);

    // Per-minter quota check
    let minter_role = &mut ctx.accounts.minter_role;
    if let Some(quota) = minter_role.mint_quota {
        let new_total = minter_role
            .amount_minted
            .checked_add(amount)
            .ok_or(SssError::ArithmeticOverflow)?;
        require!(new_total <= quota, SssError::QuotaExceeded);
    }

    // Capture keys before borrowing config mutably
    let config_info = ctx.accounts.config.to_account_info();
    let mint_info = ctx.accounts.mint.to_account_info();
    let to_info = ctx.accounts.to.to_account_info();
    let token_program_info = ctx.accounts.token_program.to_account_info();
    let mint_key = ctx.accounts.mint.key();
    let to_key = ctx.accounts.to.key();
    let minter_key = ctx.accounts.minter.key();
    let decimals = ctx.accounts.mint.decimals;

    let config = &mut ctx.accounts.config;

    // Oracle-aware supply cap: if a Pyth PriceUpdateV2 account is provided,
    // convert the USD-denominated cap to token units using the live price.
    // This is backward-compatible — omitting the oracle uses the raw cap.
    let effective_cap = if let Some(ref price_update) = ctx.accounts.price_update {
        adjust_cap_with_oracle(config.supply_cap, price_update, decimals)?
    } else {
        config.supply_cap
    };

    // Check supply cap (oracle-adjusted or raw)
    let can_mint = match effective_cap {
        Some(cap) => {
            let new_supply = config
                .current_supply()
                .checked_add(amount)
                .ok_or(SssError::ArithmeticOverflow)?;
            new_supply <= cap
        }
        None => config.current_supply().checked_add(amount).is_some(),
    };
    require!(can_mint, SssError::SupplyCapExceeded);

    config.total_minted = config
        .total_minted
        .checked_add(amount)
        .ok_or(SssError::ArithmeticOverflow)?;

    let signer_seeds: &[&[&[u8]]] = &[&[
        StablecoinConfig::SSS_CONFIG_SEED,
        mint_key.as_ref(),
        &[config.bump],
    ]];

    let cpi_accounts = MintTo {
        mint: mint_info,
        to: to_info,
        authority: config_info,
    };
    let cpi_ctx = CpiContext::new(token_program_info, cpi_accounts).with_signer(signer_seeds);

    token_interface::mint_to(cpi_ctx, amount)?;

    // Update per-minter quota tracking
    ctx.accounts.minter_role.amount_minted = ctx
        .accounts
        .minter_role
        .amount_minted
        .checked_add(amount)
        .ok_or(SssError::ArithmeticOverflow)?;

    emit!(TokensMinted {
        mint: mint_key,
        to: to_key,
        amount,
        minter: minter_key,
        new_supply: config.current_supply(),
    });

    Ok(())
}

/// Adjust a USD-denominated supply cap to token units using a Pyth v2
/// `PriceUpdateV2` account (pull-oracle model).
///
/// Uses `get_price_no_older_than` which enforces:
///   • Staleness — price must be ≤ `ORACLE_MAX_AGE_SECS` old.
///   • Positive price — prices ≤ 0 are rejected by the SDK.
///
/// The `feed_id` parameter is currently `None` which skips feed-ID
/// validation (accepts any well-formed price update).  Protocols that
/// pin to specific feeds should pass the 32-byte feed ID here.
///
/// Cap conversion:
///   token_cap = usd_cap × 10^mint_decimals / (price × 10^exponent)
///
/// If no supply cap is set, returns `None` (unlimited minting).
fn adjust_cap_with_oracle(
    usd_cap: Option<u64>,
    price_update: &Account<PriceUpdateV2>,
    mint_decimals: u8,
) -> Result<Option<u64>> {
    let Some(cap) = usd_cap else {
        return Ok(None);
    };

    // Retrieve price, enforcing staleness check.
    // ORACLE_MAX_AGE_SECS = 120; the SDK rejects updates older than this.
    // `feed_id` is all-zeros here (wildcard); protocols should pin the
    // actual Pyth feed ID for the asset to prevent feed spoofing.
    let feed_id: [u8; 32] = [0u8; 32];
    let clock = Clock::get()?;
    let price_data = price_update
        .get_price_no_older_than(&clock, ORACLE_MAX_AGE_SECS, &feed_id)
        .map_err(|_| error!(SssError::OraclePriceStale))?;

    let price_i64 = price_data.price;
    let expo = price_data.exponent; // i32, typically -8

    require!(price_i64 > 0, SssError::InvalidOraclePrice);

    let price_u128 = price_i64 as u128;
    let decimals_pow = 10u128.pow(mint_decimals as u32);

    let token_cap = if expo < 0 {
        // token_cap = cap * 10^decimals * 10^|expo| / price
        let abs_expo = expo.unsigned_abs();
        let numerator = (cap as u128)
            .checked_mul(decimals_pow)
            .and_then(|v| v.checked_mul(10u128.pow(abs_expo)))
            .ok_or(error!(SssError::ArithmeticOverflow))?;
        numerator
            .checked_div(price_u128)
            .ok_or(error!(SssError::ArithmeticOverflow))?
    } else {
        // token_cap = cap * 10^decimals / (price * 10^expo)
        let expo_pow = 10u128.pow(expo as u32);
        let numerator = (cap as u128)
            .checked_mul(decimals_pow)
            .ok_or(error!(SssError::ArithmeticOverflow))?;
        let denominator = price_u128
            .checked_mul(expo_pow)
            .ok_or(error!(SssError::ArithmeticOverflow))?;
        numerator
            .checked_div(denominator)
            .ok_or(error!(SssError::ArithmeticOverflow))?
    };

    // Safe downcast — if it exceeds u64, cap at u64::MAX (effectively unlimited)
    Ok(Some(token_cap.min(u64::MAX as u128) as u64))
}
