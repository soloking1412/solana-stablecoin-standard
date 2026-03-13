import { Connection, TransactionSignature, PublicKey } from "@solana/web3.js";

export async function confirmTx(
  connection: Connection,
  signature: TransactionSignature,
  commitment: "confirmed" | "finalized" = "confirmed"
): Promise<void> {
  const latestBlockhash = await connection.getLatestBlockhash(commitment);
  await connection.confirmTransaction(
    { signature, ...latestBlockhash },
    commitment
  );
}

export function formatAmount(raw: bigint | number, decimals: number): string {
  const val = BigInt(raw);
  const divisor = BigInt(10 ** decimals);
  const whole = val / divisor;
  const frac = val % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

export function parseAmount(human: string, decimals: number): bigint {
  const parts = human.split(".");
  const whole = BigInt(parts[0] || "0");
  const fracStr = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
  const frac = BigInt(fracStr);
  return whole * BigInt(10 ** decimals) + frac;
}

export function shortenAddress(address: PublicKey | string, chars = 4): string {
  const str = typeof address === "string" ? address : address.toBase58();
  return `${str.slice(0, chars)}...${str.slice(-chars)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
