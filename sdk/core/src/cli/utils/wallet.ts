import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

export function loadWallet(walletPath?: string): Keypair {
  const resolved = (walletPath || "~/.config/solana/id.json").replace(
    "~",
    process.env.HOME || ""
  );

  if (!fs.existsSync(resolved)) {
    throw new Error(
      `Wallet file not found: ${resolved}\nRun 'solana-keygen new' to create one.`
    );
  }

  const raw = fs.readFileSync(resolved, "utf-8");
  const secretKey = new Uint8Array(JSON.parse(raw));
  return Keypair.fromSecretKey(secretKey);
}

export function getWalletPath(options: { keypair?: string }): string {
  return (options.keypair || "~/.config/solana/id.json").replace(
    "~",
    process.env.HOME || ""
  );
}
