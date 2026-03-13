import { Router, Request, Response } from "express";
import { Connection, PublicKey } from "@solana/web3.js";
import { loadConfig } from "../config";

const router = Router();

router.get("/api/v1/supply", async (_req: Request, res: Response) => {
  try {
    const config = loadConfig();
    if (!config.mintAddress) {
      res.status(400).json({ error: "MINT_ADDRESS not configured" });
      return;
    }

    const connection = new Connection(config.rpcUrl, "confirmed");
    const mint = new PublicKey(config.mintAddress);
    const supply = await connection.getTokenSupply(mint);

    res.json({
      amount: supply.value.amount,
      decimals: supply.value.decimals,
      uiAmount: supply.value.uiAmount,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/api/v1/holders", async (req: Request, res: Response) => {
  try {
    const config = loadConfig();
    if (!config.mintAddress) {
      res.status(400).json({ error: "MINT_ADDRESS not configured" });
      return;
    }

    const connection = new Connection(config.rpcUrl, "confirmed");
    const mint = new PublicKey(config.mintAddress);
    const accounts = await connection.getTokenLargestAccounts(mint);

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const holders = accounts.value.slice(offset, offset + limit).map((acc) => ({
      address: acc.address.toBase58(),
      amount: acc.amount,
      decimals: acc.decimals,
      uiAmount: acc.uiAmount,
    }));

    res.json({ holders, total: accounts.value.length });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/api/v1/config", async (_req: Request, res: Response) => {
  const config = loadConfig();
  res.json({
    programId: config.programId,
    hookProgramId: config.hookProgramId,
    mintAddress: config.mintAddress || null,
    cluster: config.rpcUrl.includes("devnet") ? "devnet" : "mainnet",
  });
});

export default router;
