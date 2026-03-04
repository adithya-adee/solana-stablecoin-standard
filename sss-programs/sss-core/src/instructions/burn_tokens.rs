use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Burn, Mint, TokenAccount, TokenInterface};

use crate::error::SssError;
use crate::events::TokensBurned;
use crate::state::{Role, RoleAccount, StablecoinConfig};

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    pub burner: Signer<'info>,

    #[account(
        mut,
        seeds = [StablecoinConfig::SSS_CONFIG_SEED, mint.key().as_ref()],
        bump = config.bump,
        constraint = !config.paused @ SssError::Paused,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// Burner role PDA — its existence proves burn authorization.
    #[account(
        seeds = [
            RoleAccount::SSS_ROLE_SEED,
            config.key().as_ref(),
            burner.key().as_ref(),
            &[Role::Burner.as_u8()],
        ],
        bump = burner_role.bump,
    )]
    pub burner_role: Account<'info, RoleAccount>,

    #[account(
        mut,
        constraint = config.mint == mint.key() @ SssError::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    /// SECURITY NOTE — PRIVILEGED PERMANENT-DELEGATE BURN:
    /// The config PDA is the permanent delegate for this mint, so a Burner-role
    /// holder can burn tokens from ANY token account of this mint — not only
    /// their own. This is intentional for protocol compliance (e.g., burning
    /// sanctioned tokens), but it is an extremely powerful capability.
    ///
    /// Operational safeguards REQUIRED:
    ///   1. The Burner role must be assigned to a multisig (e.g., Squads).
    ///   2. All burns where `from.owner != burner` must be logged and reviewed.
    ///   3. The `TokensBurned` event emits `from_owner` to surface third-party
    ///      burns for compliance audit trails.
    ///   4. Unlike `seize`, burn is IRREVERSIBLE — the tokens are destroyed.
    #[account(
        mut,
        token::mint = mint,
    )]
    pub from: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler_burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
    require!(amount > 0, SssError::ZeroAmount);

    // Capture account infos before mutable borrow of config
    let config_info = ctx.accounts.config.to_account_info();
    let mint_info = ctx.accounts.mint.to_account_info();
    let from_info = ctx.accounts.from.to_account_info();
    let token_program_info = ctx.accounts.token_program.to_account_info();
    let mint_key = ctx.accounts.mint.key();
    let from_key = ctx.accounts.from.key();
    let from_owner = ctx.accounts.from.owner; // captured for audit event
    let burner_key = ctx.accounts.burner.key();

    let config = &mut ctx.accounts.config;
    config.total_burned = config
        .total_burned
        .checked_add(amount)
        .ok_or(SssError::ArithmeticOverflow)?;

    let signer_seeds: &[&[&[u8]]] = &[&[
        StablecoinConfig::SSS_CONFIG_SEED,
        mint_key.as_ref(),
        &[config.bump],
    ]];

    // Burn via permanent delegate authority (config PDA)
    let cpi_accounts = Burn {
        mint: mint_info,
        from: from_info,
        authority: config_info,
    };
    let cpi_ctx = CpiContext::new(token_program_info, cpi_accounts).with_signer(signer_seeds);

    token_interface::burn(cpi_ctx, amount)?;

    emit!(TokensBurned {
        mint: mint_key,
        from: from_key,
        amount,
        burner: burner_key,
        new_supply: config.current_supply(),
        from_owner,
    });

    Ok(())
}
