import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import { getConnection } from "../utils/config";
import { printTable, printError, formatAddress } from "../utils/display";

export function registerAuditCommand(program: Command): void {
  program
    .command("audit-log")
    .description("View audit log of token operations")
    .option("--action <type>", "Filter by action type (mint, burn, freeze, etc.)")
    .option("--limit <count>", "Max entries", "50")
    .action(async (opts: { action?: string; limit?: string }) => {
      const parent = program.opts();
      const spinner = ora("Fetching audit log...").start();

      try {
        const connection = getConnection(parent.cluster);
        const programId = new PublicKey(
          parent.programId || "StbMVdQRUykc9jS3bT1LCiHBqBos1awkVHFn2cFRLwR"
        );

        const limit = parseInt(opts.limit || "50");

        // Fetch recent signatures for the program
        const sigs = await connection.getSignaturesForAddress(programId, {
          limit,
        });

        spinner.stop();

        if (sigs.length === 0) {
          console.log("No transactions found.");
          return;
        }

        const rows = sigs.map((sig) => [
          sig.signature.slice(0, 16) + "...",
          sig.blockTime
            ? new Date(sig.blockTime * 1000).toISOString().replace("T", " ").slice(0, 19)
            : "unknown",
          sig.err ? "Failed" : "Success",
        ]);

        printTable(["Signature", "Timestamp", "Status"], rows);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
