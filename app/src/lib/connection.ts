import { Connection, clusterApiUrl } from "@solana/web3.js";

export function getConnection(cluster: string = "devnet"): Connection {
  const url =
    cluster === "mainnet"
      ? clusterApiUrl("mainnet-beta")
      : cluster === "localnet"
      ? "http://localhost:8899"
      : clusterApiUrl("devnet");

  return new Connection(url, "confirmed");
}
