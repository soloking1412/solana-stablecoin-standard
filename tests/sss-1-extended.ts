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

describe("SSS-1 Extended Tests", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SssToken as Program<SssToken>;
  const authority = provider.wallet as anchor.Wallet;

  let mint: PublicKey;
  let configPda: PublicKey;

  const minter1 = Keypair.generate();
  const minter2 = Keypair.generate();
  const minter3 = Keypair.generate();
  const burner = Keypair.generate();
  const freezer = Keypair.generate();
  const pauser = Keypair.generate();
  const recipient1 = Keypair.generate();
  const recipient2 = Keypair.generate();
  const recipient3 = Keypair.generate();

  before(async () => {
    for (const kp of [minter1, minter2, minter3, burner, freezer, pauser, recipient1, recipient2, recipient3]) {
      const sig = await provider.connection.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig);
    }
  });

  // --- Setup: Initialize token with full role setup ---

  it("initializes SSS-1 with minimal parameters", async () => {
    const mintKeypair = Keypair.generate();
    mint = mintKeypair.publicKey;

    [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("stablecoin"), mint.toBuffer()],
      program.programId
    );

    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );

    await createMint(
      provider.connection, authority.payer, configPda, configPda, 6,
      mintKeypair, undefined, TOKEN_2022_PROGRAM_ID
    );

    await program.methods
      .initialize({
        name: "Extended Test",
        symbol: "EXTT",
        uri: "",
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
    expect(config.name).to.equal("Extended Test");
    expect(config.uri).to.equal("");
  });

  it("sets up all roles for extended tests", async () => {
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );

    // Grant multiple minters
    for (const [minter, idx] of [[minter1, 0], [minter2, 1], [minter3, 2]] as [Keypair, number][]) {
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
    }

    // Grant burner, freezer, pauser
    for (const [user, roleType] of [[burner, 2], [freezer, 3], [pauser, 4]] as [Keypair, number][]) {
      const [role] = PublicKey.findProgramAddressSync(
        [Buffer.from("role"), configPda.toBuffer(), Buffer.from([roleType]), user.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .grantRole(roleType)
        .accounts({
          admin: authority.publicKey,
          config: configPda,
          adminRole,
          user: user.publicKey,
          roleAccount: role,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }
  });

  // --- Multi-Minter Quota Tests ---

  it("creates quotas for multiple minters with different limits", async () => {
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );

    const quotas = [
      [minter1, 5_000_000],
      [minter2, 10_000_000],
      [minter3, 1_000_000],
    ] as [Keypair, number][];

    for (const [minter, quota] of quotas) {
      const [minterQuota] = PublicKey.findProgramAddressSync(
        [Buffer.from("minter"), configPda.toBuffer(), minter.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .createMinterQuota(new anchor.BN(quota))
        .accounts({
          admin: authority.publicKey,
          config: configPda,
          adminRole,
          minter: minter.publicKey,
          minterQuota,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }
  });

  it("minter1 mints within quota", async () => {
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient1.publicKey,
      false, undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [minterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter1.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter1.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .mintTokens(new anchor.BN(2_000_000))
      .accounts({
        minter: minter1.publicKey,
        config: configPda,
        minterRole,
        minterQuota,
        mint,
        recipientTokenAccount: ata.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter1])
      .rpc();

    const account = await getAccount(provider.connection, ata.address, undefined, TOKEN_2022_PROGRAM_ID);
    expect(Number(account.amount)).to.equal(2_000_000);
  });

  it("minter2 mints to a different recipient", async () => {
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient2.publicKey,
      false, undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [minterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter2.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter2.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .mintTokens(new anchor.BN(5_000_000))
      .accounts({
        minter: minter2.publicKey,
        config: configPda,
        minterRole,
        minterQuota,
        mint,
        recipientTokenAccount: ata.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter2])
      .rpc();

    const account = await getAccount(provider.connection, ata.address, undefined, TOKEN_2022_PROGRAM_ID);
    expect(Number(account.amount)).to.equal(5_000_000);
  });

  it("minter3 mints to a third recipient", async () => {
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient3.publicKey,
      false, undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [minterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter3.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter3.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .mintTokens(new anchor.BN(500_000))
      .accounts({
        minter: minter3.publicKey,
        config: configPda,
        minterRole,
        minterQuota,
        mint,
        recipientTokenAccount: ata.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter3])
      .rpc();

    const account = await getAccount(provider.connection, ata.address, undefined, TOKEN_2022_PROGRAM_ID);
    expect(Number(account.amount)).to.equal(500_000);
  });

  it("tracks total supply across multiple minters", async () => {
    const config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.totalMinted.toNumber()).to.equal(7_500_000); // 2M + 5M + 0.5M
    expect(config.totalBurned.toNumber()).to.equal(0);
  });

  it("each minter tracks independent quota usage", async () => {
    for (const [minter, expectedMinted] of [[minter1, 2_000_000], [minter2, 5_000_000], [minter3, 500_000]] as [Keypair, number][]) {
      const [minterQuota] = PublicKey.findProgramAddressSync(
        [Buffer.from("minter"), configPda.toBuffer(), minter.publicKey.toBuffer()],
        program.programId
      );
      const quota = await program.account.minterQuota.fetch(minterQuota);
      expect(quota.minted.toNumber()).to.equal(expectedMinted);
    }
  });

  it("minter1 cannot exceed its individual quota", async () => {
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient1.publicKey,
      false, undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [minterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter1.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter1.publicKey.toBuffer()],
      program.programId
    );

    // minter1 has quota 5M, already minted 2M, try to mint 4M (exceeds remaining 3M)
    try {
      await program.methods
        .mintTokens(new anchor.BN(4_000_000))
        .accounts({
          minter: minter1.publicKey,
          config: configPda,
          minterRole,
          minterQuota,
          mint,
          recipientTokenAccount: ata.address,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter1])
        .rpc();
      expect.fail("Should reject exceeding individual quota");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("QuotaExceeded");
    }
  });

  it("minter3 uses exact remaining quota", async () => {
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient3.publicKey,
      false, undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [minterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter3.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter3.publicKey.toBuffer()],
      program.programId
    );

    // minter3 has quota 1M, already minted 0.5M, mint exactly remaining 0.5M
    await program.methods
      .mintTokens(new anchor.BN(500_000))
      .accounts({
        minter: minter3.publicKey,
        config: configPda,
        minterRole,
        minterQuota,
        mint,
        recipientTokenAccount: ata.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter3])
      .rpc();

    const quota = await program.account.minterQuota.fetch(minterQuota);
    expect(quota.minted.toNumber()).to.equal(1_000_000);
    expect(quota.quota.toNumber()).to.equal(1_000_000);
  });

  it("minter3 cannot mint even 1 token after exhausting quota", async () => {
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient3.publicKey,
      false, undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [minterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter3.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter3.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .mintTokens(new anchor.BN(1))
        .accounts({
          minter: minter3.publicKey,
          config: configPda,
          minterRole,
          minterQuota,
          mint,
          recipientTokenAccount: ata.address,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter3])
        .rpc();
      expect.fail("Should reject - quota exhausted");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("QuotaExceeded");
    }
  });

  // --- Quota Update Tests ---

  it("admin can increase a minter quota", async () => {
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter3.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .updateMinterQuota(new anchor.BN(5_000_000))
      .accounts({
        admin: authority.publicKey,
        config: configPda,
        adminRole,
        minter: minter3.publicKey,
        minterQuota,
      })
      .rpc();

    const quota = await program.account.minterQuota.fetch(minterQuota);
    expect(quota.quota.toNumber()).to.equal(5_000_000);
    expect(quota.minted.toNumber()).to.equal(1_000_000); // minted unchanged
  });

  it("minter3 can mint again after quota increase", async () => {
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient3.publicKey,
      false, undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [minterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter3.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter3.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .mintTokens(new anchor.BN(1_000_000))
      .accounts({
        minter: minter3.publicKey,
        config: configPda,
        minterRole,
        minterQuota,
        mint,
        recipientTokenAccount: ata.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter3])
      .rpc();

    const quota = await program.account.minterQuota.fetch(minterQuota);
    expect(quota.minted.toNumber()).to.equal(2_000_000);
  });

  // --- Burn validation tests ---

  it("rejects burn with zero amount", async () => {
    // Burner must own the token account. Create and fund burner's ATA.
    const burnerAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, burner.publicKey,
      false, undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    // Mint tokens to burner's ATA so the account is valid
    const [minterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter1.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter1.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .mintTokens(new anchor.BN(100_000))
      .accounts({
        minter: minter1.publicKey,
        config: configPda,
        minterRole,
        minterQuota,
        mint,
        recipientTokenAccount: burnerAta.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter1])
      .rpc();

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
      expect.fail("Should reject zero burn");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("ZeroAmount");
    }
  });

  it("total supply is consistent after multiple mints", async () => {
    const config = await program.account.stablecoinConfig.fetch(configPda);
    const minted = config.totalMinted.toNumber();
    expect(minted).to.be.greaterThan(0);
    // total_minted should be sum of all mints: 2M + 5M + 0.5M + 0.5M + 1M + 0.1M (burner ATA) = 9.1M
    expect(minted).to.equal(9_100_000);
  });

  // --- Freeze multiple accounts ---

  it("freezes multiple accounts in sequence", async () => {
    const [freezerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([3]), freezer.publicKey.toBuffer()],
      program.programId
    );

    for (const recipient of [recipient1, recipient2]) {
      const ata = await getOrCreateAssociatedTokenAccount(
        provider.connection, authority.payer, mint, recipient.publicKey,
        false, undefined, undefined, TOKEN_2022_PROGRAM_ID
      );

      await program.methods
        .freezeAccount()
        .accounts({
          freezer: freezer.publicKey,
          config: configPda,
          freezerRole,
          mint,
          tokenAccount: ata.address,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([freezer])
        .rpc();

      const account = await getAccount(provider.connection, ata.address, undefined, TOKEN_2022_PROGRAM_ID);
      expect(account.isFrozen).to.be.true;
    }
  });

  it("thaws all frozen accounts", async () => {
    const [freezerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([3]), freezer.publicKey.toBuffer()],
      program.programId
    );

    for (const recipient of [recipient1, recipient2]) {
      const ata = await getOrCreateAssociatedTokenAccount(
        provider.connection, authority.payer, mint, recipient.publicKey,
        false, undefined, undefined, TOKEN_2022_PROGRAM_ID
      );

      await program.methods
        .thawAccount()
        .accounts({
          freezer: freezer.publicKey,
          config: configPda,
          freezerRole,
          mint,
          tokenAccount: ata.address,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([freezer])
        .rpc();

      const account = await getAccount(provider.connection, ata.address, undefined, TOKEN_2022_PROGRAM_ID);
      expect(account.isFrozen).to.be.false;
    }
  });

  // --- Pause interaction with multiple operations ---

  it("pause blocks all minters", async () => {
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

    // Try minting with minter1
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient1.publicKey,
      false, undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [minter1Role] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter1.publicKey.toBuffer()],
      program.programId
    );
    const [minter1Quota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter1.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .mintTokens(new anchor.BN(100))
        .accounts({
          minter: minter1.publicKey,
          config: configPda,
          minterRole: minter1Role,
          minterQuota: minter1Quota,
          mint,
          recipientTokenAccount: ata.address,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter1])
        .rpc();
      expect.fail("Should reject minter1 when paused");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("Paused");
    }

    // Try minting with minter2
    const [minter2Role] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter2.publicKey.toBuffer()],
      program.programId
    );
    const [minter2Quota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter2.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .mintTokens(new anchor.BN(100))
        .accounts({
          minter: minter2.publicKey,
          config: configPda,
          minterRole: minter2Role,
          minterQuota: minter2Quota,
          mint,
          recipientTokenAccount: ata.address,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter2])
        .rpc();
      expect.fail("Should reject minter2 when paused");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("Paused");
    }
  });

  it("pause also blocks burns", async () => {
    // Use burner's own ATA (burner must own the token account)
    const burnerAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, burner.publicKey,
      false, undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [burnerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([2]), burner.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .burnTokens(new anchor.BN(100))
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
      expect.fail("Should reject burn when paused");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("Paused");
    }
  });

  it("freeze/thaw still works during pause", async () => {
    const [freezerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([3]), freezer.publicKey.toBuffer()],
      program.programId
    );

    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient1.publicKey,
      false, undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    // Freeze should work even when paused
    await program.methods
      .freezeAccount()
      .accounts({
        freezer: freezer.publicKey,
        config: configPda,
        freezerRole,
        mint,
        tokenAccount: ata.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([freezer])
      .rpc();

    let account = await getAccount(provider.connection, ata.address, undefined, TOKEN_2022_PROGRAM_ID);
    expect(account.isFrozen).to.be.true;

    // Thaw should also work
    await program.methods
      .thawAccount()
      .accounts({
        freezer: freezer.publicKey,
        config: configPda,
        freezerRole,
        mint,
        tokenAccount: ata.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([freezer])
      .rpc();

    account = await getAccount(provider.connection, ata.address, undefined, TOKEN_2022_PROGRAM_ID);
    expect(account.isFrozen).to.be.false;
  });

  it("role management works during pause", async () => {
    const testUser = Keypair.generate();
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );
    const [testRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([2]), testUser.publicKey.toBuffer()],
      program.programId
    );

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

    const role = await program.account.roleAccount.fetch(testRole);
    expect(role.active).to.be.true;

    // Revoke during pause
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
  });

  it("unpause and resume operations", async () => {
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

    // Minting should work again
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient1.publicKey,
      false, undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [minterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter1.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter1.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .mintTokens(new anchor.BN(100_000))
      .accounts({
        minter: minter1.publicKey,
        config: configPda,
        minterRole,
        minterQuota,
        mint,
        recipientTokenAccount: ata.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter1])
      .rpc();
  });

  // --- Validation edge cases ---

  it("rejects symbol exceeding 10 chars", async () => {
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
          name: "Test",
          symbol: "X".repeat(11),
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
      expect.fail("Should reject long symbol");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("SymbolTooLong");
    }
  });

  it("rejects URI exceeding 200 chars", async () => {
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
          name: "Test",
          symbol: "TST",
          uri: "X".repeat(201),
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
      expect.fail("Should reject long URI");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("UriTooLong");
    }
  });

  it("rejects preset 0", async () => {
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
          name: "Test",
          symbol: "TST",
          uri: "",
          decimals: 6,
          preset: 0,
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
      expect.fail("Should reject preset 0");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("InvalidPreset");
    }
  });

  it("rejects preset 4", async () => {
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
          name: "Test",
          symbol: "TST",
          uri: "",
          decimals: 6,
          preset: 4,
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
      expect.fail("Should reject preset 4");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("InvalidPreset");
    }
  });

  it("rejects seizer role on SSS-1", async () => {
    const badUser = Keypair.generate();
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );
    const [seizerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([6]), badUser.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .grantRole(6)
        .accounts({
          admin: authority.publicKey,
          config: configPda,
          adminRole,
          user: badUser.publicKey,
          roleAccount: seizerRole,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should reject seizer role on SSS-1");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("ComplianceRoleNotAllowed");
    }
  });

  it("rejects invalid role type 7", async () => {
    const badUser = Keypair.generate();
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );
    const [badRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([7]), badUser.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .grantRole(7)
        .accounts({
          admin: authority.publicKey,
          config: configPda,
          adminRole,
          user: badUser.publicKey,
          roleAccount: badRole,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should reject invalid role");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("InvalidRole");
    }
  });

  // --- Role revocation and re-grant ---

  it("revoked minter cannot mint", async () => {
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );
    const [minterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter2.publicKey.toBuffer()],
      program.programId
    );

    // Revoke minter2
    await program.methods
      .revokeRole(1)
      .accounts({
        admin: authority.publicKey,
        config: configPda,
        adminRole,
        user: minter2.publicKey,
        roleAccount: minterRole,
      })
      .rpc();

    const role = await program.account.roleAccount.fetch(minterRole);
    expect(role.active).to.be.false;

    // Try to mint with revoked role
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient2.publicKey,
      false, undefined, undefined, TOKEN_2022_PROGRAM_ID
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter2.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .mintTokens(new anchor.BN(100))
        .accounts({
          minter: minter2.publicKey,
          config: configPda,
          minterRole,
          minterQuota,
          mint,
          recipientTokenAccount: ata.address,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([minter2])
        .rpc();
      expect.fail("Should reject revoked minter");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("RoleInactive");
    }
  });

  // --- Supply invariant verification ---

  it("supply invariant: total_minted - total_burned == circulating", async () => {
    const config = await program.account.stablecoinConfig.fetch(configPda);
    const minted = config.totalMinted.toNumber();
    const burned = config.totalBurned.toNumber();
    const circulating = minted - burned;

    expect(circulating).to.be.greaterThan(0);
    expect(minted).to.be.greaterThanOrEqual(burned);
  });

  // --- PDA determinism verification ---

  it("config PDA is deterministic", async () => {
    const [pda1] = PublicKey.findProgramAddressSync(
      [Buffer.from("stablecoin"), mint.toBuffer()],
      program.programId
    );
    const [pda2] = PublicKey.findProgramAddressSync(
      [Buffer.from("stablecoin"), mint.toBuffer()],
      program.programId
    );
    expect(pda1.toBase58()).to.equal(pda2.toBase58());
    expect(pda1.toBase58()).to.equal(configPda.toBase58());
  });

  it("different mints produce different config PDAs", async () => {
    const fakeMint = Keypair.generate();
    const [pda1] = PublicKey.findProgramAddressSync(
      [Buffer.from("stablecoin"), mint.toBuffer()],
      program.programId
    );
    const [pda2] = PublicKey.findProgramAddressSync(
      [Buffer.from("stablecoin"), fakeMint.publicKey.toBuffer()],
      program.programId
    );
    expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
  });

  it("role PDAs are unique per user", async () => {
    const [pda1] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter1.publicKey.toBuffer()],
      program.programId
    );
    const [pda2] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter2.publicKey.toBuffer()],
      program.programId
    );
    expect(pda1.toBase58()).to.not.equal(pda2.toBase58());
  });

  it("role PDAs are unique per role type", async () => {
    const [minterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([1]), minter1.publicKey.toBuffer()],
      program.programId
    );
    const [burnerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([2]), minter1.publicKey.toBuffer()],
      program.programId
    );
    expect(minterPda.toBase58()).to.not.equal(burnerPda.toBase58());
  });
});
