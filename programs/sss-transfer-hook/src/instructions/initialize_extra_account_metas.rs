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
    // Token-2022 transfer hook fixed account layout:
    //   0: source token account
    //   1: mint
    //   2: destination token account
    //   3: owner/delegate (source authority)
    //   4: extra_account_metas PDA (validation account)
    //
    // Extra metas (appended after fixed accounts):
    //   5: [0] stablecoin_config  (static pubkey)
    //   6: [1] sss_token program  (static pubkey, needed for PDA derivation)
    //   7: [2] source_blacklist   (resolved PDA under sss_token)
    //   8: [3] dest_blacklist     (resolved PDA under sss_token)

    let extra_metas = vec![
        // [0] stablecoin config PDA (index 5 in full list)
        ExtraAccountMeta::new_with_pubkey(&ctx.accounts.stablecoin_config.key(), false, false)?,
        // [1] sss-token program (index 6 in full list) — needed as program_id for PDA derivation
        ExtraAccountMeta::new_with_pubkey(&ctx.accounts.stablecoin_program.key(), false, false)?,
        // [2] source blacklist PDA: seeds = [BLACKLIST_SEED, config, source_owner]
        //     program_index 6 = sss_token program
        //     config = index 5 (extra_meta[0])
        //     source owner = bytes 32..64 of source token account (index 0)
        ExtraAccountMeta::new_external_pda_with_seeds(
            6,
            &[
                Seed::Literal {
                    bytes: BLACKLIST_SEED.to_vec(),
                },
                Seed::AccountKey { index: 5 },
                Seed::AccountData {
                    account_index: 0,
                    data_index: 32,
                    length: 32,
                },
            ],
            false,
            false,
        )?,
        // [3] destination blacklist PDA: seeds = [BLACKLIST_SEED, config, dest_owner]
        //     dest owner = bytes 32..64 of destination token account (index 2)
        ExtraAccountMeta::new_external_pda_with_seeds(
            6,
            &[
                Seed::Literal {
                    bytes: BLACKLIST_SEED.to_vec(),
                },
                Seed::AccountKey { index: 5 },
                Seed::AccountData {
                    account_index: 2,
                    data_index: 32,
                    length: 32,
                },
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
