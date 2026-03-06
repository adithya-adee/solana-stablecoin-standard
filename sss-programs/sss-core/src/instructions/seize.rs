use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::error::SssError;
use crate::events::TokensSeized;
use crate::state::{Role, RoleAccount, StablecoinConfig};

#[derive(Accounts)]
pub struct Seize<'info> {
    pub seizer: Signer<'info>,

    /// NO pause check — seizure works during emergencies.
    #[account(
        seeds = [StablecoinConfig::SSS_CONFIG_SEED, mint.key().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, StablecoinConfig>,

    /// Seizer role PDA — its existence proves seizure authorization.
    #[account(
        seeds = [
            RoleAccount::SSS_ROLE_SEED,
            config.key().as_ref(),
            seizer.key().as_ref(),
            &[Role::Seizer.as_u8()],
        ],
        bump = seizer_role.bump,
    )]
    pub seizer_role: Account<'info, RoleAccount>,

    #[account(
        constraint = config.mint == mint.key() @ SssError::MintMismatch,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        token::mint = mint,
    )]
    pub from: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = mint,
    )]
    pub to: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler_seize<'info>(
    ctx: Context<'_, '_, '_, 'info, Seize<'info>>,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, SssError::ZeroAmount);

    let mint_key = ctx.accounts.mint.key();
    let decimals = ctx.accounts.mint.decimals;
    let signer_seeds: &[&[&[u8]]] = &[&[
        StablecoinConfig::SSS_CONFIG_SEED,
        mint_key.as_ref(),
        &[ctx.accounts.config.bump],
    ]];

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.from.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.to.to_account_info(),
        authority: ctx.accounts.config.to_account_info(),
    };

    // SSS-2 mints have a transfer hook that requires additional accounts
    // (extra_account_metas PDA, sender/receiver blacklist PDAs, hook program).
    // The caller must supply these as remaining_accounts so that Token-2022
    // can CPI into the hook during the transfer.
    //
    // SSS-1 / SSS-3: no hook — remaining_accounts will be empty.
    let remaining: Vec<AccountInfo<'info>> = ctx.remaining_accounts.to_vec();
    let mut cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts)
        .with_signer(signer_seeds);

    if !remaining.is_empty() {
        cpi_ctx = cpi_ctx.with_remaining_accounts(remaining);
    }

    token_interface::transfer_checked(cpi_ctx, amount, decimals)?;

    emit!(TokensSeized {
        mint: ctx.accounts.mint.key(),
        from: ctx.accounts.from.key(),
        to: ctx.accounts.to.key(),
        amount,
        seizer: ctx.accounts.seizer.key(),
    });

    Ok(())
}
