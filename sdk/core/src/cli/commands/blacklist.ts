import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import { getConnection } from "../utils/config";
import { loadWallet } from "../utils/wallet";
import { printSuccess, printError } from "../utils/display";
import { SolanaStablecoin } from "../../stablecoin";

export function registerBlacklistCommand(program: Command): void {
  const bl = program
    .command("blacklist")
    .description("Manage blacklisted addresses (SSS-2 only)");

  bl.command("add <address>")
    .description("Add address to blacklist")
    .requiredOption("--reason <reason>", "Reason for blacklisting")
    .action(async (address: string, opts: { reason: string }) => {
      const parent = program.opts();
      const spinner = ora("Adding to blacklist...").start();

      try {
        const connection = getConnection(parent.cluster);
        const wallet = loadWallet(parent.keypair);
        const mintAddress = new PublicKey(parent.mint);

        const stable = await SolanaStablecoin.load(connection, mintAddress, wallet);
        const tx = await stable.compliance.addToBlacklist(
          new PublicKey(address),
          opts.reason,
          wallet
        );

        spinner.stop();
        printSuccess(`Address blacklisted: ${address}`);
        console.log(`  Reason: ${opts.reason}`);
        console.log(`  Tx: ${tx}`);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  bl.command("remove <address>")
    .description("Remove address from blacklist")
    .action(async (address: string) => {
      const parent = program.opts();
      const spinner = ora("Removing from blacklist...").start();

      try {
        const connection = getConnection(parent.cluster);
        const wallet = loadWallet(parent.keypair);
        const mintAddress = new PublicKey(parent.mint);

        const stable = await SolanaStablecoin.load(connection, mintAddress, wallet);
        const tx = await stable.compliance.removeFromBlacklist(
          new PublicKey(address),
          wallet
        );

        spinner.stop();
        printSuccess(`Address removed from blacklist: ${address}`);
        console.log(`  Tx: ${tx}`);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  bl.command("check <address>")
    .description("Check if an address is blacklisted")
    .action(async (address: string) => {
      const parent = program.opts();

      try {
        const connection = getConnection(parent.cluster);
        const mintAddress = new PublicKey(parent.mint);
        const stable = await SolanaStablecoin.load(connection, mintAddress);

        const blacklisted = await stable.compliance.isBlacklisted(
          new PublicKey(address)
        );
        console.log(
          blacklisted
            ? `Address ${address} IS blacklisted`
            : `Address ${address} is NOT blacklisted`
        );
      } catch (err: unknown) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
