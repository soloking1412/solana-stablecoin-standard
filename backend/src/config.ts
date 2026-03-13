import "dotenv/config";

export interface AppConfig {
  port: number;
  rpcUrl: string;
  programId: string;
  hookProgramId: string;
  authorityKeypairPath: string;
  mintAddress: string;
  apiKey: string;
  logLevel: string;
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env: ${key}`);
  return val;
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || "3000", 10),
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    programId: process.env.PROGRAM_ID || "StbMVdQRUykc9jS3bT1LCiHBqBos1awkVHFn2cFRLwR",
    hookProgramId: process.env.TRANSFER_HOOK_PROGRAM_ID || "SThk8WNt3JUYTCNwUgMJeLSBbqRbGnFv6xFM4th7giQ",
    authorityKeypairPath: process.env.AUTHORITY_KEYPAIR_PATH || "~/.config/solana/id.json",
    mintAddress: process.env.MINT_ADDRESS || "",
    apiKey: process.env.API_KEY || "change-me-in-production",
    logLevel: process.env.LOG_LEVEL || "info",
  };
}
