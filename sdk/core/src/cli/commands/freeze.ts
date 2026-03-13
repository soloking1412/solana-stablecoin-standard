import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import { getConnection } from "../utils/config";
import { loadWallet } from "../utils/wallet";
import { printSuccess } from "../utils/display";
import { SolanaStablecoin } from "../../stablecoin";

export function registerFreezeCommands(program: Command): void {
  program
    .command("freeze <address>")
    .description("Freeze a token account")
    .action(async (address: string) => {
      const parent = program.opts();
      const spinner = ora("Freezing account...").start();

      try {
        const connection = getConnection(parent.cluster);
        const wallet = loadWallet(parent.keypair);
        const mintAddress = new PublicKey(parent.mint);

        const stable = await SolanaStablecoin.load(connection, mintAddress, wallet);
        const tx = await stable.freeze(new PublicKey(address), wallet);

        spinner.stop();
        printSuccess(`Account frozen: ${address}`);
        console.log(`  Tx: ${tx}`);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  program
    .command("thaw <address>")
    .description("Thaw a frozen token account")
    .action(async (address: string) => {
      const parent = program.opts();
      const spinner = ora("Thawing account...").start();

      try {
        const connection = getConnection(parent.cluster);
        const wallet = loadWallet(parent.keypair);
        const mintAddress = new PublicKey(parent.mint);

        const stable = await SolanaStablecoin.load(connection, mintAddress, wallet);
        const tx = await stable.thaw(new PublicKey(address), wallet);

        spinner.stop();
        printSuccess(`Account thawed: ${address}`);
        console.log(`  Tx: ${tx}`);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
