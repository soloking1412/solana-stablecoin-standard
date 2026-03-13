import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import { getConnection } from "../utils/config";
import { loadWallet } from "../utils/wallet";
import { printSuccess } from "../utils/display";
import { SolanaStablecoin } from "../../stablecoin";

export function registerBurnCommand(program: Command): void {
  program
    .command("burn <amount>")
    .description("Burn tokens")
    .option("--from <tokenAccount>", "Token account to burn from")
    .action(async (amount: string, opts: { from?: string }) => {
      const parent = program.opts();
      const spinner = ora("Burning tokens...").start();

      try {
        const connection = getConnection(parent.cluster);
        const wallet = loadWallet(parent.keypair);
        const mintAddress = new PublicKey(parent.mint);

        const stable = await SolanaStablecoin.load(connection, mintAddress, wallet);
        const tokenAccount = opts.from
          ? new PublicKey(opts.from)
          : new PublicKey(parent.mint); // fallback

        const tx = await stable.burn({
          tokenAccount,
          amount: BigInt(amount),
          burner: wallet,
        });

        spinner.stop();
        printSuccess(`Burned ${amount} tokens`);
        console.log(`  Tx: ${tx}`);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
