import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import { getConnection } from "../utils/config";
import { loadWallet } from "../utils/wallet";
import { printSuccess, printError, printTable } from "../utils/display";
import { SolanaStablecoin } from "../../stablecoin";
import { RoleType } from "../../types";

export function registerMintersCommand(program: Command): void {
  const minters = program
    .command("minters")
    .description("Manage minter roles and quotas");

  minters
    .command("add <address>")
    .description("Add a minter with quota")
    .requiredOption("--quota <amount>", "Minting quota")
    .action(async (address: string, opts: { quota: string }) => {
      const parent = program.opts();
      const spinner = ora("Adding minter...").start();

      try {
        const connection = getConnection(parent.cluster);
        const wallet = loadWallet(parent.keypair);
        const mintAddress = new PublicKey(parent.mint);

        const stable = await SolanaStablecoin.load(connection, mintAddress, wallet);

        await stable.roles.grantRole(
          new PublicKey(address),
          RoleType.Minter,
          wallet
        );

        await stable.roles.createMinterQuota(
          new PublicKey(address),
          BigInt(opts.quota),
          wallet
        );

        spinner.stop();
        printSuccess(`Minter added: ${address}`);
        console.log(`  Quota: ${opts.quota}`);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  minters
    .command("remove <address>")
    .description("Remove a minter")
    .action(async (address: string) => {
      const parent = program.opts();
      const spinner = ora("Removing minter...").start();

      try {
        const connection = getConnection(parent.cluster);
        const wallet = loadWallet(parent.keypair);
        const mintAddress = new PublicKey(parent.mint);

        const stable = await SolanaStablecoin.load(connection, mintAddress, wallet);
        await stable.roles.revokeRole(
          new PublicKey(address),
          RoleType.Minter,
          wallet
        );

        spinner.stop();
        printSuccess(`Minter removed: ${address}`);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  minters
    .command("list")
    .description("List all minters")
    .action(async () => {
      const parent = program.opts();
      console.log("Fetching minters... (requires on-chain account scanning)");
      console.log("Use 'sss-token roles list --role minter' for role queries.");
    });
}
