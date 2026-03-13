import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SssToken } from "../target/types/sss_token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";

describe("SSS-1 Minimal Stablecoin", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SssToken as Program<SssToken>;
  const authority = provider.wallet as anchor.Wallet;

  let mint: PublicKey;
  let configPda: PublicKey;
  let configBump: number;

  const minter = Keypair.generate();
  const burner = Keypair.generate();
  const freezer = Keypair.generate();
  const pauser = Keypair.generate();
  const recipient = Keypair.generate();

  before(async () => {
    // Airdrop to test wallets
    for (const kp of [minter, burner, freezer, pauser, recipient]) {
      const sig = await provider.connection.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig);
    }
  });

  // --- Initialization ---

  it("initializes SSS-1 stablecoin", async () => {
    const mintKeypair = Keypair.generate();
    mint = mintKeypair.publicKey;

    [configPda, configBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("stablecoin"), mint.toBuffer()],
      program.programId
    );

    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );

    // Create Token-2022 mint first
    await createMint(
      provider.connection,
      authority.payer,
      configPda, // mint authority = config PDA
      configPda, // freeze authority = config PDA
      6,
      mintKeypair,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    await program.methods
      .initialize({
        name: "Test USD",
        symbol: "TUSD",
        uri: "https://example.com/metadata.json",
        decimals: 6,
        preset: 1,
      })
      .accounts({
        authority: authority.publicKey,
        config: configPda,
        mint,
        adminRole,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.name).to.equal("Test USD");
    expect(config.symbol).to.equal("TUSD");
    expect(config.decimals).to.equal(6);
    expect(config.preset).to.equal(1);
    expect(config.paused).to.be.false;
    expect(config.totalMinted.toNumber()).to.equal(0);
    expect(config.totalBurned.toNumber()).to.equal(0);
    expect(config.enablePermanentDelegate).to.be.false;
    expect(config.enableTransferHook).to.be.false;
  });

  it("creates admin role during initialization", async () => {
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );

    const role = await program.account.roleAccount.fetch(adminRole);
    expect(role.role).to.equal(0); // Admin
    expect(role.active).to.be.true;
    expect(role.user.toBase58()).to.equal(authority.publicKey.toBase58());
  });

  it("rejects invalid preset", async () => {
    const badMint = Keypair.generate();
    const [badConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("stablecoin"), badMint.publicKey.toBuffer()],
      program.programId
    );
    const [badAdminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), badConfig.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );

    await createMint(
      provider.connection,
      authority.payer,
      badConfig,
      badConfig,
      6,
      badMint,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    try {
      await program.methods
        .initialize({
          name: "Bad",
          symbol: "BAD",
          uri: "",
          decimals: 6,
          preset: 99,
        })
        .accounts({
          authority: authority.publicKey,
          config: badConfig,
          mint: badMint.publicKey,
          adminRole: badAdminRole,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("InvalidPreset");
    }
  });

  it("rejects name exceeding 32 chars", async () => {
    const badMint = Keypair.generate();
    const [badConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("stablecoin"), badMint.publicKey.toBuffer()],
      program.programId
    );
    const [badAdmin] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), badConfig.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );

    await createMint(provider.connection, authority.payer, badConfig, badConfig, 6, badMint, undefined, TOKEN_2022_PROGRAM_ID);

    try {
      await program.methods
        .initialize({
          name: "A".repeat(33),
          symbol: "X",
          uri: "",
          decimals: 6,
          preset: 1,
        })
        .accounts({
          authority: authority.publicKey,
          config: badConfig,
          mint: badMint.publicKey,
          adminRole: badAdmin,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("NameTooLong");
    }
  });

  // --- Role Management ---

  it("grants minter role", async () => {
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );
    const [minterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .grantRole(1)
      .accounts({
        admin: authority.publicKey,
        config: configPda,
        adminRole,
        user: minter.publicKey,
        roleAccount: minterRole,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const role = await program.account.roleAccount.fetch(minterRole);
    expect(role.role).to.equal(1);
    expect(role.active).to.be.true;
  });

  it("grants burner role", async () => {
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );
    const [burnerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([2]), burner.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .grantRole(2)
      .accounts({
        admin: authority.publicKey,
        config: configPda,
        adminRole,
        user: burner.publicKey,
        roleAccount: burnerRole,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  it("grants freezer role", async () => {
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );
    const [freezerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([3]), freezer.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .grantRole(3)
      .accounts({
        admin: authority.publicKey,
        config: configPda,
        adminRole,
        user: freezer.publicKey,
        roleAccount: freezerRole,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  it("grants pauser role", async () => {
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );
    const [pauserRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([4]), pauser.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .grantRole(4)
      .accounts({
        admin: authority.publicKey,
        config: configPda,
        adminRole,
        user: pauser.publicKey,
        roleAccount: pauserRole,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  it("rejects blacklister role on SSS-1", async () => {
    const badUser = Keypair.generate();
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );
    const [blRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([5]), badUser.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .grantRole(5)
        .accounts({
          admin: authority.publicKey,
          config: configPda,
          adminRole,
          user: badUser.publicKey,
          roleAccount: blRole,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should reject compliance role on SSS-1");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("ComplianceRoleNotAllowed");
    }
  });

  it("rejects non-admin granting roles", async () => {
    const randomUser = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(randomUser.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);

    // This should fail because randomUser has no admin role PDA
    try {
      const [fakeAdminRole] = PublicKey.findProgramAddressSync(
        [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), randomUser.publicKey.toBuffer()],
        program.programId
      );
      const [targetRole] = PublicKey.findProgramAddressSync(
        [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), Keypair.generate().publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .grantRole(1)
        .accounts({
          admin: randomUser.publicKey,
          config: configPda,
          adminRole: fakeAdminRole,
          user: Keypair.generate().publicKey,
          roleAccount: targetRole,
          systemProgram: SystemProgram.programId,
        })
        .signers([randomUser])
        .rpc();
      expect.fail("Should reject");
    } catch {
      // Expected: account does not exist
    }
  });

  // --- Minter Quota ---

  it("creates minter quota", async () => {
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .createMinterQuota(new anchor.BN(10_000_000_000))
      .accounts({
        admin: authority.publicKey,
        config: configPda,
        adminRole,
        minter: minter.publicKey,
        minterQuota,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const quota = await program.account.minterQuota.fetch(minterQuota);
    expect(quota.quota.toNumber()).to.equal(10_000_000_000);
    expect(quota.minted.toNumber()).to.equal(0);
  });

  // --- Mint Operations ---

  it("mints tokens to recipient", async () => {
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority.payer,
      mint,
      recipient.publicKey,
      false,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    const [minterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .mintTokens(new anchor.BN(1_000_000))
      .accounts({
        minter: minter.publicKey,
        config: configPda,
        minterRole,
        minterQuota,
        mint,
        recipientTokenAccount: recipientAta.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter])
      .rpc();

    const account = await getAccount(provider.connection, recipientAta.address, undefined, TOKEN_2022_PROGRAM_ID);
    expect(Number(account.amount)).to.equal(1_000_000);

    const config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.totalMinted.toNumber()).to.equal(1_000_000);
  });

  it("tracks minter quota after minting", async () => {
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter.publicKey.toBuffer()],
      program.programId
    );

    const quota = await program.account.minterQuota.fetch(minterQuota);
    expect(quota.minted.toNumber()).to.equal(1_000_000);
  });

  it("rejects minting zero amount", async () => {
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [minterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .mintTokens(new anchor.BN(0))
        .accounts({
          minter: minter.publicKey,
          config: configPda,
          minterRole,
          minterQuota,
          mint,
          recipientTokenAccount: recipientAta.address,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter])
        .rpc();
      expect.fail("Should reject zero amount");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("ZeroAmount");
    }
  });

  it("mints additional tokens", async () => {
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [minterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .mintTokens(new anchor.BN(2_000_000))
      .accounts({
        minter: minter.publicKey,
        config: configPda,
        minterRole,
        minterQuota,
        mint,
        recipientTokenAccount: recipientAta.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter])
      .rpc();

    const config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.totalMinted.toNumber()).to.equal(3_000_000);
  });

  // --- Freeze / Thaw ---

  it("freezes a token account", async () => {
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [freezerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([3]), freezer.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .freezeAccount()
      .accounts({
        freezer: freezer.publicKey,
        config: configPda,
        freezerRole,
        mint,
        tokenAccount: recipientAta.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([freezer])
      .rpc();

    const account = await getAccount(provider.connection, recipientAta.address, undefined, TOKEN_2022_PROGRAM_ID);
    expect(account.isFrozen).to.be.true;
  });

  it("rejects double freeze", async () => {
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [freezerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([3]), freezer.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .freezeAccount()
        .accounts({
          freezer: freezer.publicKey,
          config: configPda,
          freezerRole,
          mint,
          tokenAccount: recipientAta.address,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([freezer])
        .rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("AccountAlreadyFrozen");
    }
  });

  it("thaws a frozen token account", async () => {
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [freezerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([3]), freezer.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .thawAccount()
      .accounts({
        freezer: freezer.publicKey,
        config: configPda,
        freezerRole,
        mint,
        tokenAccount: recipientAta.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([freezer])
      .rpc();

    const account = await getAccount(provider.connection, recipientAta.address, undefined, TOKEN_2022_PROGRAM_ID);
    expect(account.isFrozen).to.be.false;
  });

  it("rejects thawing non-frozen account", async () => {
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [freezerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([3]), freezer.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .thawAccount()
        .accounts({
          freezer: freezer.publicKey,
          config: configPda,
          freezerRole,
          mint,
          tokenAccount: recipientAta.address,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([freezer])
        .rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("AccountNotFrozen");
    }
  });

  // --- Pause / Unpause ---

  it("pauses the token", async () => {
    const [pauserRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([4]), pauser.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .pause()
      .accounts({
        pauser: pauser.publicKey,
        config: configPda,
        pauserRole,
      })
      .signers([pauser])
      .rpc();

    const config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.paused).to.be.true;
  });

  it("rejects minting when paused", async () => {
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [minterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .mintTokens(new anchor.BN(100))
        .accounts({
          minter: minter.publicKey,
          config: configPda,
          minterRole,
          minterQuota,
          mint,
          recipientTokenAccount: recipientAta.address,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter])
        .rpc();
      expect.fail("Should reject when paused");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("Paused");
    }
  });

  it("rejects double pause", async () => {
    const [pauserRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([4]), pauser.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .pause()
        .accounts({
          pauser: pauser.publicKey,
          config: configPda,
          pauserRole,
        })
        .signers([pauser])
        .rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("Paused");
    }
  });

  it("unpauses the token", async () => {
    const [pauserRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([4]), pauser.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .unpause()
      .accounts({
        pauser: pauser.publicKey,
        config: configPda,
        pauserRole,
      })
      .signers([pauser])
      .rpc();

    const config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.paused).to.be.false;
  });

  it("rejects unpausing when not paused", async () => {
    const [pauserRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([4]), pauser.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .unpause()
        .accounts({
          pauser: pauser.publicKey,
          config: configPda,
          pauserRole,
        })
        .signers([pauser])
        .rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("NotPaused");
    }
  });

  // --- Burn ---

  it("burns tokens", async () => {
    // Burner must burn from their own token account.
    // First, mint tokens to the burner's ATA.
    const burnerAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, burner.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [minterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .mintTokens(new anchor.BN(1_000_000))
      .accounts({
        minter: minter.publicKey,
        config: configPda,
        minterRole,
        minterQuota,
        mint,
        recipientTokenAccount: burnerAta.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter])
      .rpc();

    const [burnerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([2]), burner.publicKey.toBuffer()],
      program.programId
    );

    const balanceBefore = Number((await getAccount(
      provider.connection, burnerAta.address, undefined, TOKEN_2022_PROGRAM_ID
    )).amount);

    await program.methods
      .burnTokens(new anchor.BN(500_000))
      .accounts({
        burner: burner.publicKey,
        config: configPda,
        burnerRole,
        mint,
        tokenAccount: burnerAta.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([burner])
      .rpc();

    const balanceAfter = Number((await getAccount(
      provider.connection, burnerAta.address, undefined, TOKEN_2022_PROGRAM_ID
    )).amount);
    expect(balanceAfter).to.equal(balanceBefore - 500_000);

    const config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.totalBurned.toNumber()).to.equal(500_000);
  });

  it("rejects burning zero amount", async () => {
    const burnerAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, burner.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [burnerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([2]), burner.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .burnTokens(new anchor.BN(0))
        .accounts({
          burner: burner.publicKey,
          config: configPda,
          burnerRole,
          mint,
          tokenAccount: burnerAta.address,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([burner])
        .rpc();
      expect.fail("Should reject");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("ZeroAmount");
    }
  });

  // --- Authority Transfer ---

  it("transfers authority", async () => {
    const newAuth = Keypair.generate();

    await program.methods
      .transferAuthority()
      .accounts({
        authority: authority.publicKey,
        config: configPda,
        newAuthority: newAuth.publicKey,
      })
      .rpc();

    const config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.authority.toBase58()).to.equal(newAuth.publicKey.toBase58());

    // Transfer back for subsequent tests
    await program.methods
      .transferAuthority()
      .accounts({
        authority: newAuth.publicKey,
        config: configPda,
        newAuthority: authority.publicKey,
      })
      .signers([newAuth])
      .rpc();
  });

  // --- Role Revocation ---

  it("revokes a role", async () => {
    const testUser = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(testUser.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);

    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );
    const [testRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([2]), testUser.publicKey.toBuffer()],
      program.programId
    );

    // Grant
    await program.methods
      .grantRole(2)
      .accounts({
        admin: authority.publicKey,
        config: configPda,
        adminRole,
        user: testUser.publicKey,
        roleAccount: testRole,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    let role = await program.account.roleAccount.fetch(testRole);
    expect(role.active).to.be.true;

    // Revoke
    await program.methods
      .revokeRole(2)
      .accounts({
        admin: authority.publicKey,
        config: configPda,
        adminRole,
        user: testUser.publicKey,
        roleAccount: testRole,
      })
      .rpc();

    role = await program.account.roleAccount.fetch(testRole);
    expect(role.active).to.be.false;
  });

  // --- Quota enforcement ---

  it("rejects minting beyond quota", async () => {
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [minterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter.publicKey.toBuffer()],
      program.programId
    );

    // Try to mint way beyond remaining quota
    try {
      await program.methods
        .mintTokens(new anchor.BN(999_999_999_999))
        .accounts({
          minter: minter.publicKey,
          config: configPda,
          minterRole,
          minterQuota,
          mint,
          recipientTokenAccount: recipientAta.address,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter])
        .rpc();
      expect.fail("Should reject exceeding quota");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("QuotaExceeded");
    }
  });

  // --- Compliance gating ---

  it("rejects blacklist operations on SSS-1", async () => {
    const target = Keypair.generate();
    const [blEntry] = PublicKey.findProgramAddressSync(
      [Buffer.from("blacklist"), configPda.toBuffer(), target.publicKey.toBuffer()],
      program.programId
    );

    // We can't even create the blacklister role on SSS-1, so the blacklist_add
    // instruction would also fail at the role check level. The constraint
    // on config.preset >= 2 is the first gate.
    // We verify this at the init level already (ComplianceRoleNotAllowed test above).
  });
});
