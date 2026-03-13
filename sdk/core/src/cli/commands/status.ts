import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import chalk from "chalk";
import { getConnection } from "../utils/config";
import { loadWallet } from "../utils/wallet";
import { printTokenInfo, printError } from "../utils/display";
import { SolanaStablecoin } from "../../stablecoin";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show token status and configuration")
    .action(async () => {
      const parent = program.opts();
      const spinner = ora("Fetching token info...").start();

      try {
        const connection = getConnection(parent.cluster);
        const mintAddress = new PublicKey(parent.mint);
        const stable = await SolanaStablecoin.load(connection, mintAddress);
        const config = await stable.getConfig();

        spinner.stop();
        console.log(chalk.bold("\nToken Status"));
        console.log("─".repeat(40));
        printTokenInfo(config as any);

        if (config.preset >= 2) {
          console.log(chalk.bold("\nCompliance Features"));
          console.log(`  Permanent Delegate: ${config.enablePermanentDelegate ? chalk.green("Enabled") : "Disabled"}`);
          console.log(`  Transfer Hook:      ${config.enableTransferHook ? chalk.green("Enabled") : "Disabled"}`);
          console.log(`  Default Frozen:     ${config.defaultAccountFrozen ? chalk.green("Yes") : "No"}`);
        }
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  program
    .command("supply")
    .description("Show token supply information")
    .action(async () => {
      const parent = program.opts();

      try {
        const connection = getConnection(parent.cluster);
        const mintAddress = new PublicKey(parent.mint);
        const stable = await SolanaStablecoin.load(connection, mintAddress);
        const supply = await stable.getTotalSupply();

        console.log(chalk.bold("\nSupply Info"));
        console.log("─".repeat(30));
        console.log(`  Minted:      ${supply.totalMinted.toString()}`);
        console.log(`  Burned:      ${supply.totalBurned.toString()}`);
        console.log(`  Circulating: ${supply.circulating.toString()}`);
      } catch (err: unknown) {
        printError(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
