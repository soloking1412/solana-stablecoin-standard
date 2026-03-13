import { PublicKey, Connection } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { getBlacklistAddress } from "./pda";
import { BlacklistEntry, SeizeParams } from "./types";
import { parseAnchorError } from "./errors";

export class ComplianceManager {
  constructor(
    private program: Program,
    private configAddress: PublicKey,
    private mint: PublicKey,
    private connection: Connection
  ) {}

  async addToBlacklist(
    address: PublicKey,
    reason: string,
    blacklister: { publicKey: PublicKey; secretKey: Uint8Array }
  ): Promise<string> {
    try {
      const [blacklistEntry] = getBlacklistAddress(
        this.configAddress,
        address,
        this.program.programId
      );
      const [blacklisterRole] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          this.configAddress.toBuffer(),
          Buffer.from([5]), // Blacklister
          blacklister.publicKey.toBuffer(),
        ],
        this.program.programId
      );

      const tx = await this.program.methods
        .blacklistAdd(reason)
        .accounts({
          blacklister: blacklister.publicKey,
          config: this.configAddress,
          blacklisterRole,
          address,
          blacklistEntry,
          systemProgram: PublicKey.default,
        })
        .signers([blacklister as any])
        .rpc();

      return tx;
    } catch (err) {
      throw parseAnchorError(err);
    }
  }

  async removeFromBlacklist(
    address: PublicKey,
    blacklister: { publicKey: PublicKey; secretKey: Uint8Array }
  ): Promise<string> {
    try {
      const [blacklistEntry] = getBlacklistAddress(
        this.configAddress,
        address,
        this.program.programId
      );
      const [blacklisterRole] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          this.configAddress.toBuffer(),
          Buffer.from([5]),
          blacklister.publicKey.toBuffer(),
        ],
        this.program.programId
      );

      const tx = await this.program.methods
        .blacklistRemove()
        .accounts({
          blacklister: blacklister.publicKey,
          config: this.configAddress,
          blacklisterRole,
          address,
          blacklistEntry,
        })
        .signers([blacklister as any])
        .rpc();

      return tx;
    } catch (err) {
      throw parseAnchorError(err);
    }
  }

  async seize(params: SeizeParams): Promise<string> {
    try {
      const [seizerRole] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("role"),
          this.configAddress.toBuffer(),
          Buffer.from([6]), // Seizer
          params.seizer.publicKey.toBuffer(),
        ],
        this.program.programId
      );

      const tx = await this.program.methods
        .seize()
        .accounts({
          seizer: params.seizer.publicKey,
          config: this.configAddress,
          seizerRole,
          mint: this.mint,
          fromAccount: params.fromAccount,
          toAccount: params.toAccount,
        })
        .signers([params.seizer])
        .rpc();

      return tx;
    } catch (err) {
      throw parseAnchorError(err);
    }
  }

  async isBlacklisted(address: PublicKey): Promise<boolean> {
    try {
      const [pda] = getBlacklistAddress(
        this.configAddress,
        address,
        this.program.programId
      );
      const info = await this.connection.getAccountInfo(pda);
      return info !== null && info.data.length > 0;
    } catch {
      return false;
    }
  }

  async getBlacklistEntry(address: PublicKey): Promise<BlacklistEntry | null> {
    try {
      const [pda] = getBlacklistAddress(
        this.configAddress,
        address,
        this.program.programId
      );
      const account = await this.program.account.blacklistEntry.fetch(pda);
      return account as unknown as BlacklistEntry;
    } catch {
      return null;
    }
  }
}
