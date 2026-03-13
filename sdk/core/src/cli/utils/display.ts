import chalk from "chalk";
import Table from "cli-table3";
import { PublicKey } from "@solana/web3.js";

export function printSuccess(msg: string): void {
  console.log(chalk.green("✓") + " " + msg);
}

export function printError(msg: string): void {
  console.log(chalk.red("✗") + " " + msg);
}

export function printWarning(msg: string): void {
  console.log(chalk.yellow("⚠") + " " + msg);
}

export function printTable(headers: string[], rows: string[][]): void {
  const table = new Table({
    head: headers.map((h) => chalk.cyan(h)),
    style: { head: [], border: [] },
  });
  for (const row of rows) {
    table.push(row);
  }
  console.log(table.toString());
}

export function printTokenInfo(config: Record<string, unknown>): void {
  const table = new Table({ style: { head: [], border: [] } });
  table.push(
    { [chalk.bold("Name")]: config.name },
    { [chalk.bold("Symbol")]: config.symbol },
    { [chalk.bold("Decimals")]: config.decimals },
    { [chalk.bold("Preset")]: `SSS-${config.preset}` },
    { [chalk.bold("Authority")]: (config.authority as PublicKey).toBase58() },
    { [chalk.bold("Mint")]: (config.mint as PublicKey).toBase58() },
    { [chalk.bold("Paused")]: config.paused ? chalk.red("Yes") : chalk.green("No") },
    { [chalk.bold("Total Minted")]: config.totalMinted?.toString() },
    { [chalk.bold("Total Burned")]: config.totalBurned?.toString() }
  );
  console.log(table.toString());
}

export function formatAddress(pubkey: PublicKey | string, chars = 4): string {
  const str = typeof pubkey === "string" ? pubkey : pubkey.toBase58();
  return `${str.slice(0, chars)}...${str.slice(-chars)}`;
}

export function formatLamports(amount: bigint | number, decimals: number): string {
  const val = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const whole = val / divisor;
  const frac = val % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}
