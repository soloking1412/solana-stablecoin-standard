import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";

import { getConfigAddress, getRoleAddress, getMinterQuotaAddress } from "./pda";
import { PRESET_CONFIGS, getPresetConfig, isCompliant } from "./presets";
import {
  CreateParams,
  MintParams,
  BurnParams,
  StablecoinConfig,
  HolderInfo,
  Preset,
  RoleType,
} from "./types";
import { ComplianceManager } from "./compliance";
import { RoleManager } from "./roles";
import { EventManager, EventCallback, TokensMintedEvent } from "./events";
import { parseAnchorError, StablecoinSdkError } from "./errors";

const SSS_TOKEN_PROGRAM_ID = new PublicKey(
  "StbMVdQRUykc9jS3bT1LCiHBqBos1awkVHFn2cFRLwR"
);
const SSS_HOOK_PROGRAM_ID = new PublicKey(
  "SThk8WNt3JUYTCNwUgMJeLSBbqRbGnFv6xFM4th7giQ"
);

export class SolanaStablecoin {
  public readonly connection: Connection;
  public readonly program: Program;
  public readonly mint: PublicKey;
  public readonly configAddress: PublicKey;
  public readonly compliance: ComplianceManager;
  public readonly roles: RoleManager;

  private config: StablecoinConfig | null = null;
  private events: EventManager;

  private constructor(
    connection: Connection,
    program: Program,
    mint: PublicKey,
    configAddress: PublicKey
  ) {
    this.connection = connection;
    this.program = program;
    this.mint = mint;
    this.configAddress = configAddress;
    this.events = new EventManager();
    this.compliance = new ComplianceManager(
      program,
      configAddress,
      mint,
      connection
    );
    this.roles = new RoleManager(program, configAddress);
  }

  /**
   * Initialize a new stablecoin with the given parameters.
   * The mint must already be created with appropriate Token-2022 extensions.
   */
  static async create(
    connection: Connection,
    params: CreateParams
  ): Promise<SolanaStablecoin> {
    const provider = new AnchorProvider(
      connection,
      new Wallet(params.authority),
      { commitment: "confirmed" }
    );

    // Load IDL from chain or use local
    const program = new Program(
      require("../../target/idl/sss_token.json"),
      provider
    );

    const mint = Keypair.generate();
    const preset = params.preset || Preset.SSS_1;
    const decimals = params.decimals ?? 6;
    const uri = params.uri || "";

    const [configAddress] = getConfigAddress(mint.publicKey, program.programId);
    const [adminRole] = getRoleAddress(
      configAddress,
      RoleType.Admin,
      params.authority.publicKey,
      program.programId
    );

    try {
      await program.methods
        .initialize({
          name: params.name,
          symbol: params.symbol,
          uri,
          decimals,
          preset,
        })
        .accounts({
          authority: params.authority.publicKey,
          config: configAddress,
          mint: mint.publicKey,
          adminRole,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: PublicKey.default,
        })
        .signers([params.authority, mint])
        .rpc();
    } catch (err) {
      throw parseAnchorError(err);
    }

    const instance = new SolanaStablecoin(
      connection,
      program,
      mint.publicKey,
      configAddress
    );
    await instance.refreshConfig();
    return instance;
  }

  /**
   * Load an existing stablecoin by its mint address.
   */
  static async load(
    connection: Connection,
    mint: PublicKey,
    authority?: Keypair
  ): Promise<SolanaStablecoin> {
    const wallet = authority
      ? new Wallet(authority)
      : new Wallet(Keypair.generate()); // read-only mode

    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });

    const program = new Program(
      require("../../target/idl/sss_token.json"),
      provider
    );

    const [configAddress] = getConfigAddress(mint, program.programId);
    const instance = new SolanaStablecoin(
      connection,
      program,
      mint,
      configAddress
    );
    await instance.refreshConfig();
    return instance;
  }

  async refreshConfig(): Promise<StablecoinConfig> {
    try {
      const raw = await this.program.account.stablecoinConfig.fetch(
        this.configAddress
      );
      this.config = raw as unknown as StablecoinConfig;
      return this.config;
    } catch (err) {
      throw parseAnchorError(err);
    }
  }

  async getConfig(): Promise<StablecoinConfig> {
    if (!this.config) return this.refreshConfig();
    return this.config;
  }

  async mint(params: MintParams): Promise<string> {
    try {
      const amount = new BN(params.amount.toString());
      const [minterRole] = getRoleAddress(
        this.configAddress,
        RoleType.Minter,
        params.minter.publicKey,
        this.program.programId
      );
      const [minterQuota] = getMinterQuotaAddress(
        this.configAddress,
        params.minter.publicKey,
        this.program.programId
      );

      const tx = await this.program.methods
        .mintTokens(amount)
        .accounts({
          minter: params.minter.publicKey,
          config: this.configAddress,
          minterRole,
          minterQuota,
          mint: this.mint,
          recipientTokenAccount: params.recipient,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([params.minter])
        .rpc();

      this.events.emit("mint", {
        recipient: params.recipient,
        amount: params.amount,
        minter: params.minter.publicKey,
      });

      return tx;
    } catch (err) {
      throw parseAnchorError(err);
    }
  }

  async burn(params: BurnParams): Promise<string> {
    try {
      const amount = new BN(params.amount.toString());
      const [burnerRole] = getRoleAddress(
        this.configAddress,
        RoleType.Burner,
        params.burner.publicKey,
        this.program.programId
      );

      const tx = await this.program.methods
        .burnTokens(amount)
        .accounts({
          burner: params.burner.publicKey,
          config: this.configAddress,
          burnerRole,
          mint: this.mint,
          tokenAccount: params.tokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([params.burner])
        .rpc();

      return tx;
    } catch (err) {
      throw parseAnchorError(err);
    }
  }

  async freeze(
    tokenAccount: PublicKey,
    freezer: Keypair
  ): Promise<string> {
    try {
      const [freezerRole] = getRoleAddress(
        this.configAddress,
        RoleType.Freezer,
        freezer.publicKey,
        this.program.programId
      );

      const tx = await this.program.methods
        .freezeAccount()
        .accounts({
          freezer: freezer.publicKey,
          config: this.configAddress,
          freezerRole,
          mint: this.mint,
          tokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([freezer])
        .rpc();

      return tx;
    } catch (err) {
      throw parseAnchorError(err);
    }
  }

  async thaw(
    tokenAccount: PublicKey,
    freezer: Keypair
  ): Promise<string> {
    try {
      const [freezerRole] = getRoleAddress(
        this.configAddress,
        RoleType.Freezer,
        freezer.publicKey,
        this.program.programId
      );

      const tx = await this.program.methods
        .thawAccount()
        .accounts({
          freezer: freezer.publicKey,
          config: this.configAddress,
          freezerRole,
          mint: this.mint,
          tokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([freezer])
        .rpc();

      return tx;
    } catch (err) {
      throw parseAnchorError(err);
    }
  }

  async pause(pauser: Keypair): Promise<string> {
    try {
      const [pauserRole] = getRoleAddress(
        this.configAddress,
        RoleType.Pauser,
        pauser.publicKey,
        this.program.programId
      );

      const tx = await this.program.methods
        .pause()
        .accounts({
          pauser: pauser.publicKey,
          config: this.configAddress,
          pauserRole,
        })
        .signers([pauser])
        .rpc();

      return tx;
    } catch (err) {
      throw parseAnchorError(err);
    }
  }

  async unpause(pauser: Keypair): Promise<string> {
    try {
      const [pauserRole] = getRoleAddress(
        this.configAddress,
        RoleType.Pauser,
        pauser.publicKey,
        this.program.programId
      );

      const tx = await this.program.methods
        .unpause()
        .accounts({
          pauser: pauser.publicKey,
          config: this.configAddress,
          pauserRole,
        })
        .signers([pauser])
        .rpc();

      return tx;
    } catch (err) {
      throw parseAnchorError(err);
    }
  }

  async transferAuthority(
    newAuthority: PublicKey,
    currentAuthority: Keypair
  ): Promise<string> {
    try {
      const tx = await this.program.methods
        .transferAuthority()
        .accounts({
          authority: currentAuthority.publicKey,
          config: this.configAddress,
          newAuthority,
        })
        .signers([currentAuthority])
        .rpc();

      return tx;
    } catch (err) {
      throw parseAnchorError(err);
    }
  }

  async getTotalSupply(): Promise<{
    totalMinted: bigint;
    totalBurned: bigint;
    circulating: bigint;
  }> {
    const config = await this.refreshConfig();
    const minted = BigInt(config.totalMinted.toString());
    const burned = BigInt(config.totalBurned.toString());
    return {
      totalMinted: minted,
      totalBurned: burned,
      circulating: minted - burned,
    };
  }

  async getHolders(opts?: { minBalance?: number }): Promise<HolderInfo[]> {
    const accounts = await this.connection.getTokenLargestAccounts(this.mint);
    const holders: HolderInfo[] = [];

    for (const account of accounts.value) {
      const balance = BigInt(account.amount);
      if (opts?.minBalance && balance < BigInt(opts.minBalance)) continue;

      const accountInfo = await this.connection.getParsedAccountInfo(
        account.address
      );
      const parsed = (accountInfo.value?.data as any)?.parsed;

      holders.push({
        address: new PublicKey(parsed?.info?.owner || PublicKey.default),
        tokenAccount: account.address,
        balance,
        isFrozen: parsed?.info?.state === "frozen",
      });
    }

    return holders;
  }

  onMint(callback: EventCallback<TokensMintedEvent>): () => void {
    return this.events.on("mint", callback);
  }

  onBurn(callback: EventCallback): () => void {
    return this.events.on("burn", callback);
  }

  onBlacklistChange(callback: EventCallback): () => void {
    return this.events.on("blacklist", callback);
  }

  destroy(): void {
    this.events.removeAll();
  }
}
