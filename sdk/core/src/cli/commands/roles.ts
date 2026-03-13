import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import { getConnection } from "../utils/config";
import { loadWallet } from "../utils/wallet";
import { printSuccess, printError } from "../utils/display";
import { SolanaStablecoin } from "../../stablecoin";
import { RoleType } from "../../types";

const ROLE_MAP: Record<string, RoleType> = {
  admin: RoleType.Admin,
  minter: RoleType.Minter,
  burner: RoleType.Burner,
  freezer: RoleType.Freezer,
  pauser: RoleType.Pauser,
  blacklister: RoleType.Blacklister,
  seizer: RoleType.Seizer,
};

export function registerRolesCommand(program: Command): void {
  const roles = program
    .command("roles")
    .description("Manage role assignments");

  roles
    .command("grant <address>")
    .description("Grant a role to an address")
    .requiredOption("--role <type>", "Role: admin, minter, burner, freezer, pauser, blacklister, seizer")
    .action(async (address: string, opts: { role: string }) => {
      const parent = program.opts();
      const spinner = ora("Granting role...").start();

      try {
        const roleType = ROLE_MAP[opts.role.toLowerCase()];
        if (roleType === undefined) {
          spinner.fail(`Invalid role: ${opts.role}`);
          process.exit(1);
        }

        const connection = getConnection(parent.cluster);
        const wallet = loadWallet(parent.keypair);
        const mintAddress = new PublicKey(parent.mint);

        const stable = await SolanaStablecoin.load(connection, mintAddress, wallet);
        const tx = await stable.roles.grantRole(
          new PublicKey(address),
          roleType,
          wallet
        );

        spinner.stop();
        printSuccess(`Role '${opts.role}' granted to ${address}`);
        console.log(`  Tx: ${tx}`);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  roles
    .command("revoke <address>")
    .description("Revoke a role from an address")
    .requiredOption("--role <type>", "Role to revoke")
    .action(async (address: string, opts: { role: string }) => {
      const parent = program.opts();
      const spinner = ora("Revoking role...").start();

      try {
        const roleType = ROLE_MAP[opts.role.toLowerCase()];
        if (roleType === undefined) {
          spinner.fail(`Invalid role: ${opts.role}`);
          process.exit(1);
        }

        const connection = getConnection(parent.cluster);
        const wallet = loadWallet(parent.keypair);
        const mintAddress = new PublicKey(parent.mint);

        const stable = await SolanaStablecoin.load(connection, mintAddress, wallet);
        const tx = await stable.roles.revokeRole(
          new PublicKey(address),
          roleType,
          wallet
        );

        spinner.stop();
        printSuccess(`Role '${opts.role}' revoked from ${address}`);
        console.log(`  Tx: ${tx}`);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  roles
    .command("check <address>")
    .description("Check roles for an address")
    .action(async (address: string) => {
      const parent = program.opts();

      try {
        const connection = getConnection(parent.cluster);
        const mintAddress = new PublicKey(parent.mint);
        const stable = await SolanaStablecoin.load(connection, mintAddress);

        const results: string[] = [];
        for (const [name, type] of Object.entries(ROLE_MAP)) {
          const has = await stable.roles.hasRole(new PublicKey(address), type);
          if (has) results.push(name);
        }

        if (results.length) {
          console.log(`Roles for ${address}: ${results.join(", ")}`);
        } else {
          console.log(`No roles found for ${address}`);
        }
      } catch (err: unknown) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
