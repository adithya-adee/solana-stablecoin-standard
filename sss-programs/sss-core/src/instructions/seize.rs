use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

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

    // Manually build the TransferChecked instruction to ensure exact account forwarding
    // for Token-2022 transfer hooks.
    let mut account_metas = vec![
        AccountMeta::new(ctx.accounts.from.key(), false),
        AccountMeta::new_readonly(ctx.accounts.mint.key(), false),
        AccountMeta::new(ctx.accounts.to.key(), false),
        AccountMeta::new_readonly(ctx.accounts.config.key(), true), // Authority (is_signer = true for invoke_signed)
    ];

    // Append extra hook accounts
    for acc in ctx.remaining_accounts.iter() {
        account_metas.push(AccountMeta {
            pubkey: acc.key(),
            is_signer: acc.is_signer,
            is_writable: acc.is_writable,
        });
    }

    let mut data = Vec::with_capacity(13);
    data.push(12); // TransferChecked discriminator for Token-2022
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(decimals);

    let ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: ctx.accounts.token_program.key(),
        accounts: account_metas,
        data,
    };

    let mut invoke_accounts = vec![
        ctx.accounts.from.to_account_info(),
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.to.to_account_info(),
        ctx.accounts.config.to_account_info(),
    ];
    invoke_accounts.extend_from_slice(&ctx.remaining_accounts);

    anchor_lang::solana_program::program::invoke_signed(&ix, &invoke_accounts, signer_seeds)?;

    emit!(TokensSeized {
        mint: ctx.accounts.mint.key(),
        from: ctx.accounts.from.key(),
        to: ctx.accounts.to.key(),
        amount,
        seizer: ctx.accounts.seizer.key(),
    });

    Ok(())
}
