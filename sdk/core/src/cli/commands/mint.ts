import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import { getConnection } from "../utils/config";
import { loadWallet } from "../utils/wallet";
import { printSuccess, printError } from "../utils/display";
import { SolanaStablecoin } from "../../stablecoin";

export function registerMintCommand(program: Command): void {
  program
    .command("mint <recipient> <amount>")
    .description("Mint tokens to a recipient")
    .action(async (recipient: string, amount: string) => {
      const parent = program.opts();
      const spinner = ora("Minting tokens...").start();

      try {
        const connection = getConnection(parent.cluster);
        const wallet = loadWallet(parent.keypair);
        const mintAddress = new PublicKey(parent.mint);

        const stable = await SolanaStablecoin.load(connection, mintAddress, wallet);
        const tx = await stable.mint({
          recipient: new PublicKey(recipient),
          amount: BigInt(amount),
          minter: wallet,
        });

        spinner.stop();
        printSuccess(`Minted ${amount} tokens to ${recipient}`);
        console.log(`  Tx: ${tx}`);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
