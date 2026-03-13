import { PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { getRoleAddress, getMinterQuotaAddress } from "./pda";
import { RoleType, RoleAccount } from "./types";
import { parseAnchorError } from "./errors";

export class RoleManager {
  constructor(
    private program: Program,
    private configAddress: PublicKey
  ) {}

  async grantRole(
    user: PublicKey,
    roleType: RoleType,
    admin: { publicKey: PublicKey; secretKey: Uint8Array }
  ): Promise<string> {
    try {
      const [adminRole] = getRoleAddress(
        this.configAddress,
        RoleType.Admin,
        admin.publicKey,
        this.program.programId
      );
      const [roleAccount] = getRoleAddress(
        this.configAddress,
        roleType,
        user,
        this.program.programId
      );

      const tx = await this.program.methods
        .grantRole(roleType)
        .accounts({
          admin: admin.publicKey,
          config: this.configAddress,
          adminRole,
          user,
          roleAccount,
          systemProgram: PublicKey.default,
        })
        .signers([admin as any])
        .rpc();

      return tx;
    } catch (err) {
      throw parseAnchorError(err);
    }
  }

  async revokeRole(
    user: PublicKey,
    roleType: RoleType,
    admin: { publicKey: PublicKey; secretKey: Uint8Array }
  ): Promise<string> {
    try {
      const [adminRole] = getRoleAddress(
        this.configAddress,
        RoleType.Admin,
        admin.publicKey,
        this.program.programId
      );
      const [roleAccount] = getRoleAddress(
        this.configAddress,
        roleType,
        user,
        this.program.programId
      );

      const tx = await this.program.methods
        .revokeRole(roleType)
        .accounts({
          admin: admin.publicKey,
          config: this.configAddress,
          adminRole,
          user,
          roleAccount,
        })
        .signers([admin as any])
        .rpc();

      return tx;
    } catch (err) {
      throw parseAnchorError(err);
    }
  }

  async hasRole(user: PublicKey, roleType: RoleType): Promise<boolean> {
    try {
      const [pda] = getRoleAddress(
        this.configAddress,
        roleType,
        user,
        this.program.programId
      );
      const account = await this.program.account.roleAccount.fetch(pda);
      return (account as unknown as RoleAccount).active;
    } catch {
      return false;
    }
  }

  async createMinterQuota(
    minter: PublicKey,
    quota: bigint | number,
    admin: { publicKey: PublicKey; secretKey: Uint8Array }
  ): Promise<string> {
    try {
      const [adminRole] = getRoleAddress(
        this.configAddress,
        RoleType.Admin,
        admin.publicKey,
        this.program.programId
      );
      const [minterQuota] = getMinterQuotaAddress(
        this.configAddress,
        minter,
        this.program.programId
      );

      const tx = await this.program.methods
        .createMinterQuota(BigInt(quota))
        .accounts({
          admin: admin.publicKey,
          config: this.configAddress,
          adminRole,
          minter,
          minterQuota,
          systemProgram: PublicKey.default,
        })
        .signers([admin as any])
        .rpc();

      return tx;
    } catch (err) {
      throw parseAnchorError(err);
    }
  }

  async updateMinterQuota(
    minter: PublicKey,
    newQuota: bigint | number,
    admin: { publicKey: PublicKey; secretKey: Uint8Array }
  ): Promise<string> {
    try {
      const [adminRole] = getRoleAddress(
        this.configAddress,
        RoleType.Admin,
        admin.publicKey,
        this.program.programId
      );
      const [minterQuota] = getMinterQuotaAddress(
        this.configAddress,
        minter,
        this.program.programId
      );

      const tx = await this.program.methods
        .updateMinterQuota(BigInt(newQuota))
        .accounts({
          admin: admin.publicKey,
          config: this.configAddress,
          adminRole,
          minter,
          minterQuota,
        })
        .signers([admin as any])
        .rpc();

      return tx;
    } catch (err) {
      throw parseAnchorError(err);
    }
  }
}
