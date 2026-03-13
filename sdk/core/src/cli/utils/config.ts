import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

export interface ConfigFile {
  name: string;
  symbol: string;
  decimals?: number;
  uri?: string;
  preset?: number;
  extensions?: {
    permanentDelegate?: boolean;
    transferHook?: boolean;
    defaultAccountFrozen?: boolean;
  };
}

export function resolveCluster(input: string): string {
  switch (input) {
    case "mainnet":
    case "mainnet-beta":
      return clusterApiUrl("mainnet-beta");
    case "devnet":
      return clusterApiUrl("devnet");
    case "localnet":
    case "localhost":
      return "http://localhost:8899";
    default:
      return input; // custom RPC URL
  }
}

export function getConnection(cluster: string): Connection {
  const url = resolveCluster(cluster);
  return new Connection(url, "confirmed");
}

export function loadKeypair(keypairPath: string): Keypair {
  const resolved = keypairPath.replace("~", process.env.HOME || "");
  const raw = fs.readFileSync(resolved, "utf-8");
  const secretKey = new Uint8Array(JSON.parse(raw));
  return Keypair.fromSecretKey(secretKey);
}

export function loadConfig(configPath: string): ConfigFile {
  const ext = path.extname(configPath).toLowerCase();
  const raw = fs.readFileSync(configPath, "utf-8");

  if (ext === ".json") {
    return JSON.parse(raw) as ConfigFile;
  }

  if (ext === ".toml") {
    const toml = require("@iarna/toml");
    return toml.parse(raw) as unknown as ConfigFile;
  }

  throw new Error(`Unsupported config format: ${ext}. Use .json or .toml`);
}
