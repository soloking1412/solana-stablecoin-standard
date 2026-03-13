import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import { getConnection } from "../utils/config";
import { loadWallet } from "../utils/wallet";
import { printSuccess } from "../utils/display";
import { SolanaStablecoin } from "../../stablecoin";

export function registerSeizeCommand(program: Command): void {
  program
    .command("seize <address>")
    .description("Seize tokens from a frozen account (SSS-2 only)")
    .requiredOption("--to <treasury>", "Treasury address to receive seized tokens")
    .action(async (address: string, opts: { to: string }) => {
      const parent = program.opts();
      const spinner = ora("Seizing tokens...").start();

      try {
        const connection = getConnection(parent.cluster);
        const wallet = loadWallet(parent.keypair);
        const mintAddress = new PublicKey(parent.mint);

        const stable = await SolanaStablecoin.load(connection, mintAddress, wallet);
        const tx = await stable.compliance.seize({
          fromAccount: new PublicKey(address),
          toAccount: new PublicKey(opts.to),
          seizer: wallet,
        });

        spinner.stop();
        printSuccess(`Tokens seized from ${address}`);
        console.log(`  To: ${opts.to}`);
        console.log(`  Tx: ${tx}`);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
