import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import { getConnection } from "../utils/config";
import { loadWallet } from "../utils/wallet";
import { printTable, printError, formatAddress } from "../utils/display";
import { SolanaStablecoin } from "../../stablecoin";

export function registerHoldersCommand(program: Command): void {
  program
    .command("holders")
    .description("List token holders")
    .option("--min-balance <amount>", "Minimum balance filter")
    .option("--limit <count>", "Max holders to display", "20")
    .action(async (opts: { minBalance?: string; limit?: string }) => {
      const parent = program.opts();
      const spinner = ora("Fetching holders...").start();

      try {
        const connection = getConnection(parent.cluster);
        const mintAddress = new PublicKey(parent.mint);

        const stable = await SolanaStablecoin.load(connection, mintAddress);
        const holders = await stable.getHolders({
          minBalance: opts.minBalance ? parseInt(opts.minBalance) : undefined,
        });

        spinner.stop();

        if (holders.length === 0) {
          console.log("No holders found.");
          return;
        }

        const limit = parseInt(opts.limit || "20");
        const rows = holders.slice(0, limit).map((h) => [
          formatAddress(h.address),
          h.balance.toString(),
          h.isFrozen ? "Frozen" : "Active",
        ]);

        printTable(["Owner", "Balance", "Status"], rows);
        console.log(`\nTotal holders: ${holders.length}`);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
