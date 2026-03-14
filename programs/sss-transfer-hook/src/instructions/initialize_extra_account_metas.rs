use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token_interface::Mint;
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::ExecuteInstruction;

use crate::state::*;

#[derive(Accounts)]
pub struct InitializeExtraAccountMetas<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: The extra account metas PDA — validated by seeds
    #[account(
        mut,
        seeds = [EXTRA_METAS_SEED, mint.key().as_ref()],
        bump,
    )]
    pub extra_account_metas: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: The stablecoin config PDA from the main program
    pub stablecoin_config: UncheckedAccount<'info>,

    /// CHECK: The main sss_token program
    pub stablecoin_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeExtraAccountMetas>) -> Result<()> {
    let extra_metas = vec![
        // [0] stablecoin config PDA — passed as-is to the execute hook
        ExtraAccountMeta::new_with_pubkey(&ctx.accounts.stablecoin_config.key(), false, false)?,
        // [1] source blacklist PDA — derived from [BLACKLIST_SEED, config, source_owner]
        // We use external PDA resolution:  the source owner is at index 2 in the
        // transfer instruction accounts (owner of source token account).
        ExtraAccountMeta::new_external_pda_with_seeds(
            0, // stablecoin_program index in extra metas... we'll use literal pubkey
            &[
                Seed::Literal {
                    bytes: BLACKLIST_SEED.to_vec(),
                },
                Seed::AccountKey { index: 0 }, // stablecoin_config (extra meta 0)
                Seed::AccountKey { index: 3 }, // source token account owner
            ],
            false,
            false,
        )?,
        // [2] destination blacklist PDA — derived from [BLACKLIST_SEED, config, dest_owner]
        ExtraAccountMeta::new_external_pda_with_seeds(
            0,
            &[
                Seed::Literal {
                    bytes: BLACKLIST_SEED.to_vec(),
                },
                Seed::AccountKey { index: 0 }, // stablecoin_config
                Seed::AccountKey { index: 4 }, // destination token account owner
            ],
            false,
            false,
        )?,
    ];

    let metas_account = &ctx.accounts.extra_account_metas;
    let mint_key = ctx.accounts.mint.key();
    let bump = ctx.bumps.extra_account_metas;
    let signer_seeds: &[&[u8]] = &[EXTRA_METAS_SEED, mint_key.as_ref(), &[bump]];

    let account_size = ExtraAccountMetaList::size_of(extra_metas.len())?;

    // Allocate space for the extra account metas list
    system_program::create_account(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::CreateAccount {
                from: ctx.accounts.authority.to_account_info(),
                to: metas_account.to_account_info(),
            },
            &[signer_seeds],
        ),
        Rent::get()?.minimum_balance(account_size),
        account_size as u64,
        ctx.program_id,
    )?;

    // Write the metas to the PDA
    let mut data = metas_account.try_borrow_mut_data()?;
    ExtraAccountMetaList::init::<ExecuteInstruction>(&mut data, &extra_metas)?;

    Ok(())
}
