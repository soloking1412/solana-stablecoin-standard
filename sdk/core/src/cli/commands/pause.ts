import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import { getConnection } from "../utils/config";
import { loadWallet } from "../utils/wallet";
import { printSuccess } from "../utils/display";
import { SolanaStablecoin } from "../../stablecoin";

export function registerPauseCommands(program: Command): void {
  program
    .command("pause")
    .description("Pause all token operations")
    .action(async () => {
      const parent = program.opts();
      const spinner = ora("Pausing token...").start();

      try {
        const connection = getConnection(parent.cluster);
        const wallet = loadWallet(parent.keypair);
        const mintAddress = new PublicKey(parent.mint);

        const stable = await SolanaStablecoin.load(connection, mintAddress, wallet);
        const tx = await stable.pause(wallet);

        spinner.stop();
        printSuccess("Token paused");
        console.log(`  Tx: ${tx}`);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  program
    .command("unpause")
    .description("Resume token operations")
    .action(async () => {
      const parent = program.opts();
      const spinner = ora("Unpausing token...").start();

      try {
        const connection = getConnection(parent.cluster);
        const wallet = loadWallet(parent.keypair);
        const mintAddress = new PublicKey(parent.mint);

        const stable = await SolanaStablecoin.load(connection, mintAddress, wallet);
        const tx = await stable.unpause(wallet);

        spinner.stop();
        printSuccess("Token unpaused");
        console.log(`  Tx: ${tx}`);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
