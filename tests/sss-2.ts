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
  ExtensionType,
  getMintLen,
  createInitializePermanentDelegateInstruction,
  createInitializeMintInstruction,
} from "@solana/spl-token";
import { Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { expect } from "chai";

describe("SSS-2 Compliant Stablecoin", () => {
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
  const blacklister = Keypair.generate();
  const seizer = Keypair.generate();
  const recipient = Keypair.generate();
  const treasury = Keypair.generate();

  before(async () => {
    for (const kp of [minter, burner, freezer, pauser, blacklister, seizer, recipient, treasury]) {
      const sig = await provider.connection.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig);
    }
  });

  // --- Initialization ---

  it("initializes SSS-2 stablecoin with compliance features", async () => {
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

    // Create Token-2022 mint WITH PermanentDelegate extension for SSS-2
    const extensions = [ExtensionType.PermanentDelegate];
    const mintLen = getMintLen(extensions);
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(mintLen);

    const createAccountIx = SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    });

    const initPermanentDelegateIx = createInitializePermanentDelegateInstruction(
      mintKeypair.publicKey,
      configPda, // config PDA is the permanent delegate
      TOKEN_2022_PROGRAM_ID,
    );

    const initMintIx = createInitializeMintInstruction(
      mintKeypair.publicKey,
      6, // decimals
      configPda, // mint authority
      configPda, // freeze authority
      TOKEN_2022_PROGRAM_ID,
    );

    const tx = new Transaction().add(createAccountIx, initPermanentDelegateIx, initMintIx);
    await sendAndConfirmTransaction(provider.connection, tx, [authority.payer, mintKeypair]);

    await program.methods
      .initialize({
        name: "Compliant USD",
        symbol: "CUSD",
        uri: "https://example.com/cusd-metadata.json",
        decimals: 6,
        preset: 2,
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
    expect(config.name).to.equal("Compliant USD");
    expect(config.symbol).to.equal("CUSD");
    expect(config.decimals).to.equal(6);
    expect(config.preset).to.equal(2);
    expect(config.paused).to.be.false;
    expect(config.totalMinted.toNumber()).to.equal(0);
    expect(config.totalBurned.toNumber()).to.equal(0);
  });

  it("has compliance flags enabled for SSS-2", async () => {
    const config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.enablePermanentDelegate).to.be.true;
    expect(config.enableTransferHook).to.be.true;
    expect(config.defaultAccountFrozen).to.be.true;
  });

  it("creates admin role during initialization", async () => {
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );

    const role = await program.account.roleAccount.fetch(adminRole);
    expect(role.role).to.equal(0);
    expect(role.active).to.be.true;
    expect(role.user.toBase58()).to.equal(authority.publicKey.toBase58());
    expect(role.config.toBase58()).to.equal(configPda.toBase58());
  });

  // --- Role Management ---

  it("grants blacklister role on SSS-2", async () => {
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );
    const [blRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([5]), blacklister.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .grantRole(5)
      .accounts({
        admin: authority.publicKey,
        config: configPda,
        adminRole,
        user: blacklister.publicKey,
        roleAccount: blRole,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const role = await program.account.roleAccount.fetch(blRole);
    expect(role.role).to.equal(5);
    expect(role.active).to.be.true;
    expect(role.user.toBase58()).to.equal(blacklister.publicKey.toBase58());
  });

  it("grants seizer role on SSS-2", async () => {
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );
    const [szRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([6]), seizer.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .grantRole(6)
      .accounts({
        admin: authority.publicKey,
        config: configPda,
        adminRole,
        user: seizer.publicKey,
        roleAccount: szRole,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const role = await program.account.roleAccount.fetch(szRole);
    expect(role.role).to.equal(6);
    expect(role.active).to.be.true;
  });

  it("grants minter, burner, and freezer roles", async () => {
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );

    // Minter
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

    // Burner
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

    // Freezer
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

    // Pauser
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

    const mRole = await program.account.roleAccount.fetch(minterRole);
    expect(mRole.role).to.equal(1);
    expect(mRole.active).to.be.true;

    const bRole = await program.account.roleAccount.fetch(burnerRole);
    expect(bRole.role).to.equal(2);
    expect(bRole.active).to.be.true;

    const fRole = await program.account.roleAccount.fetch(freezerRole);
    expect(fRole.role).to.equal(3);
    expect(fRole.active).to.be.true;
  });

  it("rejects invalid role type", async () => {
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );
    const badUser = Keypair.generate();
    const [badRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([99]), badUser.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .grantRole(99)
        .accounts({
          admin: authority.publicKey,
          config: configPda,
          adminRole,
          user: badUser.publicKey,
          roleAccount: badRole,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      expect.fail("Should reject invalid role type");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("InvalidRole");
    }
  });

  it("revokes a role and verifies it becomes inactive", async () => {
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
    expect(role.role).to.equal(2);
  });

  // --- Mint Operations ---

  it("creates minter quota for SSS-2", async () => {
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .createMinterQuota(new anchor.BN(50_000_000_000))
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
    expect(quota.quota.toNumber()).to.equal(50_000_000_000);
    expect(quota.minted.toNumber()).to.equal(0);
  });

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
      .mintTokens(new anchor.BN(5_000_000))
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
    expect(Number(account.amount)).to.equal(5_000_000);

    const config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.totalMinted.toNumber()).to.equal(5_000_000);
  });

  it("tracks minter quota after minting", async () => {
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter.publicKey.toBuffer()],
      program.programId
    );

    const quota = await program.account.minterQuota.fetch(minterQuota);
    expect(quota.minted.toNumber()).to.equal(5_000_000);
    expect(quota.quota.toNumber()).to.equal(50_000_000_000);
  });

  it("rejects minting when paused", async () => {
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
      expect.fail("Should reject minting when paused");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("Paused");
    }

    // Unpause for subsequent tests
    await program.methods
      .unpause()
      .accounts({
        pauser: pauser.publicKey,
        config: configPda,
        pauserRole,
      })
      .signers([pauser])
      .rpc();
  });

  // --- Blacklist Operations ---

  it("adds an address to the blacklist", async () => {
    const target = Keypair.generate();

    const [blEntry] = PublicKey.findProgramAddressSync(
      [Buffer.from("blacklist"), configPda.toBuffer(), target.publicKey.toBuffer()],
      program.programId
    );
    const [blRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([5]), blacklister.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .blacklistAdd("Suspicious activity")
      .accounts({
        blacklister: blacklister.publicKey,
        config: configPda,
        blacklisterRole: blRole,
        address: target.publicKey,
        blacklistEntry: blEntry,
        systemProgram: SystemProgram.programId,
      })
      .signers([blacklister])
      .rpc();

    const entry = await program.account.blacklistEntry.fetch(blEntry);
    expect(entry.address.toBase58()).to.equal(target.publicKey.toBase58());
    expect(entry.reason).to.equal("Suspicious activity");
    expect(entry.config.toBase58()).to.equal(configPda.toBase58());
  });

  it("verifies blacklist entry data has reason and timestamp", async () => {
    const target = Keypair.generate();

    const [blEntry] = PublicKey.findProgramAddressSync(
      [Buffer.from("blacklist"), configPda.toBuffer(), target.publicKey.toBuffer()],
      program.programId
    );
    const [blRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([5]), blacklister.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .blacklistAdd("OFAC sanctions list")
      .accounts({
        blacklister: blacklister.publicKey,
        config: configPda,
        blacklisterRole: blRole,
        address: target.publicKey,
        blacklistEntry: blEntry,
        systemProgram: SystemProgram.programId,
      })
      .signers([blacklister])
      .rpc();

    const entry = await program.account.blacklistEntry.fetch(blEntry);
    expect(entry.reason).to.equal("OFAC sanctions list");
    expect(entry.blacklistedBy.toBase58()).to.equal(blacklister.publicKey.toBase58());
    expect(entry.blacklistedAt.toNumber()).to.be.greaterThan(0);
  });

  it("rejects adding an already-blacklisted address", async () => {
    const target = Keypair.generate();

    const [blEntry] = PublicKey.findProgramAddressSync(
      [Buffer.from("blacklist"), configPda.toBuffer(), target.publicKey.toBuffer()],
      program.programId
    );
    const [blRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([5]), blacklister.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .blacklistAdd("First offense")
      .accounts({
        blacklister: blacklister.publicKey,
        config: configPda,
        blacklisterRole: blRole,
        address: target.publicKey,
        blacklistEntry: blEntry,
        systemProgram: SystemProgram.programId,
      })
      .signers([blacklister])
      .rpc();

    try {
      await program.methods
        .blacklistAdd("Duplicate attempt")
        .accounts({
          blacklister: blacklister.publicKey,
          config: configPda,
          blacklisterRole: blRole,
          address: target.publicKey,
          blacklistEntry: blEntry,
          systemProgram: SystemProgram.programId,
        })
        .signers([blacklister])
        .rpc();
      expect.fail("Should reject duplicate blacklist entry");
    } catch {
      // PDA already exists, init will fail
    }
  });

  it("removes an address from the blacklist", async () => {
    const target = Keypair.generate();

    const [blEntry] = PublicKey.findProgramAddressSync(
      [Buffer.from("blacklist"), configPda.toBuffer(), target.publicKey.toBuffer()],
      program.programId
    );
    const [blRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([5]), blacklister.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .blacklistAdd("Temporary restriction")
      .accounts({
        blacklister: blacklister.publicKey,
        config: configPda,
        blacklisterRole: blRole,
        address: target.publicKey,
        blacklistEntry: blEntry,
        systemProgram: SystemProgram.programId,
      })
      .signers([blacklister])
      .rpc();

    // Verify it exists
    const entry = await program.account.blacklistEntry.fetch(blEntry);
    expect(entry.address.toBase58()).to.equal(target.publicKey.toBase58());

    // Remove
    await program.methods
      .blacklistRemove()
      .accounts({
        blacklister: blacklister.publicKey,
        config: configPda,
        blacklisterRole: blRole,
        address: target.publicKey,
        blacklistEntry: blEntry,
      })
      .signers([blacklister])
      .rpc();
  });

  it("verifies blacklist PDA is closed after removal", async () => {
    const target = Keypair.generate();

    const [blEntry] = PublicKey.findProgramAddressSync(
      [Buffer.from("blacklist"), configPda.toBuffer(), target.publicKey.toBuffer()],
      program.programId
    );
    const [blRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([5]), blacklister.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .blacklistAdd("Will be removed")
      .accounts({
        blacklister: blacklister.publicKey,
        config: configPda,
        blacklisterRole: blRole,
        address: target.publicKey,
        blacklistEntry: blEntry,
        systemProgram: SystemProgram.programId,
      })
      .signers([blacklister])
      .rpc();

    await program.methods
      .blacklistRemove()
      .accounts({
        blacklister: blacklister.publicKey,
        config: configPda,
        blacklisterRole: blRole,
        address: target.publicKey,
        blacklistEntry: blEntry,
      })
      .signers([blacklister])
      .rpc();

    // Account should no longer exist
    const info = await provider.connection.getAccountInfo(blEntry);
    expect(info).to.be.null;
  });

  it("blacklists with different reasons", async () => {
    const target1 = Keypair.generate();
    const target2 = Keypair.generate();

    const [blEntry1] = PublicKey.findProgramAddressSync(
      [Buffer.from("blacklist"), configPda.toBuffer(), target1.publicKey.toBuffer()],
      program.programId
    );
    const [blEntry2] = PublicKey.findProgramAddressSync(
      [Buffer.from("blacklist"), configPda.toBuffer(), target2.publicKey.toBuffer()],
      program.programId
    );
    const [blRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([5]), blacklister.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .blacklistAdd("Fraud detected")
      .accounts({
        blacklister: blacklister.publicKey,
        config: configPda,
        blacklisterRole: blRole,
        address: target1.publicKey,
        blacklistEntry: blEntry1,
        systemProgram: SystemProgram.programId,
      })
      .signers([blacklister])
      .rpc();

    await program.methods
      .blacklistAdd("Regulatory request")
      .accounts({
        blacklister: blacklister.publicKey,
        config: configPda,
        blacklisterRole: blRole,
        address: target2.publicKey,
        blacklistEntry: blEntry2,
        systemProgram: SystemProgram.programId,
      })
      .signers([blacklister])
      .rpc();

    const entry1 = await program.account.blacklistEntry.fetch(blEntry1);
    const entry2 = await program.account.blacklistEntry.fetch(blEntry2);
    expect(entry1.reason).to.equal("Fraud detected");
    expect(entry2.reason).to.equal("Regulatory request");
  });

  // --- Freeze and Seize Flow ---

  it("freezes a token account for seizure", async () => {
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

  it("seizes tokens from a frozen account", async () => {
    const recipientAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, recipient.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );
    const treasuryAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, treasury.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const balanceBefore = Number((await getAccount(
      provider.connection, recipientAta.address, undefined, TOKEN_2022_PROGRAM_ID
    )).amount);

    const [seizerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([6]), seizer.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .seize()
      .accounts({
        seizer: seizer.publicKey,
        config: configPda,
        seizerRole,
        mint,
        fromAccount: recipientAta.address,
        toAccount: treasuryAta.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([seizer])
      .rpc();

    const fromBalance = Number((await getAccount(
      provider.connection, recipientAta.address, undefined, TOKEN_2022_PROGRAM_ID
    )).amount);
    expect(fromBalance).to.equal(0);
  });

  it("verifies seized balance transferred to treasury", async () => {
    const treasuryAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, treasury.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const treasuryBalance = Number((await getAccount(
      provider.connection, treasuryAta.address, undefined, TOKEN_2022_PROGRAM_ID
    )).amount);
    expect(treasuryBalance).to.equal(5_000_000);
  });

  it("rejects seize from a non-frozen account", async () => {
    // Mint fresh tokens to a new user
    const victim = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(victim.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);

    const victimAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, victim.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );
    const treasuryAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, treasury.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    // Mint some tokens to the victim
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
        recipientTokenAccount: victimAta.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter])
      .rpc();

    const [seizerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([6]), seizer.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .seize()
        .accounts({
          seizer: seizer.publicKey,
          config: configPda,
          seizerRole,
          mint,
          fromAccount: victimAta.address,
          toAccount: treasuryAta.address,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([seizer])
        .rpc();
      expect.fail("Should reject seize from non-frozen account");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("AccountMustBeFrozen");
    }
  });

  it("rejects seize when frozen account has zero balance", async () => {
    const emptyUser = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(emptyUser.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);

    const emptyAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, emptyUser.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );
    const treasuryAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, treasury.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    // Freeze the empty account
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
        tokenAccount: emptyAta.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([freezer])
      .rpc();

    const [seizerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([6]), seizer.publicKey.toBuffer()],
      program.programId
    );

    try {
      await program.methods
        .seize()
        .accounts({
          seizer: seizer.publicKey,
          config: configPda,
          seizerRole,
          mint,
          fromAccount: emptyAta.address,
          toAccount: treasuryAta.address,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([seizer])
        .rpc();
      expect.fail("Should reject seize with zero balance");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("InsufficientBalance");
    }
  });

  // --- Pause Interactions ---

  it("pauses the SSS-2 token", async () => {
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

  it("rejects minting while token is paused", async () => {
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
        .mintTokens(new anchor.BN(500_000))
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
      expect.fail("Should reject minting while paused");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("Paused");
    }
  });

  it("allows seize even when paused", async () => {
    // Mint tokens before pausing (need to unpause, mint, re-pause)
    const [pauserRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([4]), pauser.publicKey.toBuffer()],
      program.programId
    );

    // Unpause briefly to mint
    await program.methods
      .unpause()
      .accounts({
        pauser: pauser.publicKey,
        config: configPda,
        pauserRole,
      })
      .signers([pauser])
      .rpc();

    const seizeTarget = Keypair.generate();
    const sig2 = await provider.connection.requestAirdrop(seizeTarget.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig2);

    const targetAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, seizeTarget.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );
    const treasuryAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, treasury.publicKey, false,
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
        recipientTokenAccount: targetAta.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter])
      .rpc();

    // Freeze the account
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
        tokenAccount: targetAta.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([freezer])
      .rpc();

    // Re-pause
    await program.methods
      .pause()
      .accounts({
        pauser: pauser.publicKey,
        config: configPda,
        pauserRole,
      })
      .signers([pauser])
      .rpc();

    // Seize should still work while paused
    const [seizerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([6]), seizer.publicKey.toBuffer()],
      program.programId
    );

    const treasuryBefore = Number((await getAccount(
      provider.connection, treasuryAta.address, undefined, TOKEN_2022_PROGRAM_ID
    )).amount);

    await program.methods
      .seize()
      .accounts({
        seizer: seizer.publicKey,
        config: configPda,
        seizerRole,
        mint,
        fromAccount: targetAta.address,
        toAccount: treasuryAta.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([seizer])
      .rpc();

    const treasuryAfter = Number((await getAccount(
      provider.connection, treasuryAta.address, undefined, TOKEN_2022_PROGRAM_ID
    )).amount);
    expect(treasuryAfter).to.equal(treasuryBefore + 2_000_000);
  });

  it("unpauses and allows minting again", async () => {
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

    // Use treasury's ATA (unfrozen) instead of recipient's ATA (frozen after seize)
    const treasuryAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, mint, treasury.publicKey, false,
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
      .mintTokens(new anchor.BN(3_000_000))
      .accounts({
        minter: minter.publicKey,
        config: configPda,
        minterRole,
        minterQuota,
        mint,
        recipientTokenAccount: treasuryAta.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([minter])
      .rpc();

    const config = await program.account.stablecoinConfig.fetch(configPda);
    expect(config.paused).to.be.false;
    expect(config.totalMinted.toNumber()).to.be.greaterThan(5_000_000);
  });

  // --- Full Lifecycle ---

  it("executes a complete SSS-2 lifecycle: init -> roles -> mint -> blacklist -> freeze -> seize", async () => {
    // Fresh mint for the lifecycle test
    const lcMintKeypair = Keypair.generate();
    const lcMint = lcMintKeypair.publicKey;

    const [lcConfig] = PublicKey.findProgramAddressSync(
      [Buffer.from("stablecoin"), lcMint.toBuffer()],
      program.programId
    );
    const [lcAdmin] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), lcConfig.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );

    // Create Token-2022 mint WITH PermanentDelegate extension for SSS-2 lifecycle test
    const lcExtensions = [ExtensionType.PermanentDelegate];
    const lcMintLen = getMintLen(lcExtensions);
    const lcLamports = await provider.connection.getMinimumBalanceForRentExemption(lcMintLen);

    const lcCreateAccountIx = SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      newAccountPubkey: lcMintKeypair.publicKey,
      space: lcMintLen,
      lamports: lcLamports,
      programId: TOKEN_2022_PROGRAM_ID,
    });

    const lcInitPermanentDelegateIx = createInitializePermanentDelegateInstruction(
      lcMintKeypair.publicKey,
      lcConfig, // config PDA is the permanent delegate
      TOKEN_2022_PROGRAM_ID,
    );

    const lcInitMintIx = createInitializeMintInstruction(
      lcMintKeypair.publicKey,
      6,
      lcConfig, // mint authority
      lcConfig, // freeze authority
      TOKEN_2022_PROGRAM_ID,
    );

    const lcTx = new Transaction().add(lcCreateAccountIx, lcInitPermanentDelegateIx, lcInitMintIx);
    await sendAndConfirmTransaction(provider.connection, lcTx, [authority.payer, lcMintKeypair]);

    await program.methods
      .initialize({
        name: "Lifecycle USD",
        symbol: "LCUSD",
        uri: "",
        decimals: 6,
        preset: 2,
      })
      .accounts({
        authority: authority.publicKey,
        config: lcConfig,
        mint: lcMint,
        adminRole: lcAdmin,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    // Grant all roles
    const lcMinter = Keypair.generate();
    const lcFreezer = Keypair.generate();
    const lcBlacklister = Keypair.generate();
    const lcSeizer = Keypair.generate();

    for (const kp of [lcMinter, lcFreezer, lcBlacklister, lcSeizer]) {
      const s = await provider.connection.requestAirdrop(kp.publicKey, LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(s);
    }

    const grantRole = async (roleType: number, user: Keypair) => {
      const [roleAcc] = PublicKey.findProgramAddressSync(
        [Buffer.from("role"), lcConfig.toBuffer(), Buffer.from([roleType]), user.publicKey.toBuffer()],
        program.programId
      );
      await program.methods
        .grantRole(roleType)
        .accounts({
          admin: authority.publicKey,
          config: lcConfig,
          adminRole: lcAdmin,
          user: user.publicKey,
          roleAccount: roleAcc,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    };

    await grantRole(1, lcMinter);
    await grantRole(3, lcFreezer);
    await grantRole(5, lcBlacklister);
    await grantRole(6, lcSeizer);

    // Create minter quota
    const [lcMinterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), lcConfig.toBuffer(), lcMinter.publicKey.toBuffer()],
      program.programId
    );
    await program.methods
      .createMinterQuota(new anchor.BN(100_000_000))
      .accounts({
        admin: authority.publicKey,
        config: lcConfig,
        adminRole: lcAdmin,
        minter: lcMinter.publicKey,
        minterQuota: lcMinterQuota,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Mint tokens
    const lcRecipient = Keypair.generate();
    const s = await provider.connection.requestAirdrop(lcRecipient.publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(s);

    const lcRecipientAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, lcMint, lcRecipient.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );

    const [lcMinterRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), lcConfig.toBuffer(), Buffer.from([1]), lcMinter.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .mintTokens(new anchor.BN(10_000_000))
      .accounts({
        minter: lcMinter.publicKey,
        config: lcConfig,
        minterRole: lcMinterRole,
        minterQuota: lcMinterQuota,
        mint: lcMint,
        recipientTokenAccount: lcRecipientAta.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([lcMinter])
      .rpc();

    // Blacklist the recipient
    const [lcBlEntry] = PublicKey.findProgramAddressSync(
      [Buffer.from("blacklist"), lcConfig.toBuffer(), lcRecipient.publicKey.toBuffer()],
      program.programId
    );
    const [lcBlRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), lcConfig.toBuffer(), Buffer.from([5]), lcBlacklister.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .blacklistAdd("Compliance violation")
      .accounts({
        blacklister: lcBlacklister.publicKey,
        config: lcConfig,
        blacklisterRole: lcBlRole,
        address: lcRecipient.publicKey,
        blacklistEntry: lcBlEntry,
        systemProgram: SystemProgram.programId,
      })
      .signers([lcBlacklister])
      .rpc();

    // Freeze the account
    const [lcFreezerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), lcConfig.toBuffer(), Buffer.from([3]), lcFreezer.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .freezeAccount()
      .accounts({
        freezer: lcFreezer.publicKey,
        config: lcConfig,
        freezerRole: lcFreezerRole,
        mint: lcMint,
        tokenAccount: lcRecipientAta.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([lcFreezer])
      .rpc();

    // Seize tokens
    const lcTreasuryAta = await getOrCreateAssociatedTokenAccount(
      provider.connection, authority.payer, lcMint, authority.publicKey, false,
      undefined, undefined, TOKEN_2022_PROGRAM_ID
    );
    const [lcSeizerRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), lcConfig.toBuffer(), Buffer.from([6]), lcSeizer.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .seize()
      .accounts({
        seizer: lcSeizer.publicKey,
        config: lcConfig,
        seizerRole: lcSeizerRole,
        mint: lcMint,
        fromAccount: lcRecipientAta.address,
        toAccount: lcTreasuryAta.address,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([lcSeizer])
      .rpc();

    const finalBalance = Number((await getAccount(
      provider.connection, lcTreasuryAta.address, undefined, TOKEN_2022_PROGRAM_ID
    )).amount);
    expect(finalBalance).to.equal(10_000_000);

    const fromBalance = Number((await getAccount(
      provider.connection, lcRecipientAta.address, undefined, TOKEN_2022_PROGRAM_ID
    )).amount);
    expect(fromBalance).to.equal(0);
  });

  it("transfers authority to a new keypair", async () => {
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

    // Transfer back
    await program.methods
      .transferAuthority()
      .accounts({
        authority: newAuth.publicKey,
        config: configPda,
        newAuthority: authority.publicKey,
      })
      .signers([newAuth])
      .rpc();

    const restored = await program.account.stablecoinConfig.fetch(configPda);
    expect(restored.authority.toBase58()).to.equal(authority.publicKey.toBase58());
  });

  it("updates minter quota", async () => {
    const [adminRole] = PublicKey.findProgramAddressSync(
      [Buffer.from("role"), configPda.toBuffer(), Buffer.from([0]), authority.publicKey.toBuffer()],
      program.programId
    );
    const [minterQuota] = PublicKey.findProgramAddressSync(
      [Buffer.from("minter"), configPda.toBuffer(), minter.publicKey.toBuffer()],
      program.programId
    );

    const quotaBefore = await program.account.minterQuota.fetch(minterQuota);
    const oldQuota = quotaBefore.quota.toNumber();

    await program.methods
      .updateMinterQuota(new anchor.BN(100_000_000_000))
      .accounts({
        admin: authority.publicKey,
        config: configPda,
        adminRole,
        minter: minter.publicKey,
        minterQuota,
      })
      .rpc();

    const quotaAfter = await program.account.minterQuota.fetch(minterQuota);
    expect(quotaAfter.quota.toNumber()).to.equal(100_000_000_000);
    expect(quotaAfter.quota.toNumber()).to.not.equal(oldQuota);
  });
});
