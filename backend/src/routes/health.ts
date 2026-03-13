import { Router, Request, Response } from "express";
import { Connection } from "@solana/web3.js";
import { loadConfig } from "../config";

const router = Router();
const startTime = Date.now();

router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: "0.1.0",
    cluster: loadConfig().rpcUrl.includes("devnet") ? "devnet" : "mainnet",
    programId: loadConfig().programId,
  });
});

router.get("/ready", async (_req: Request, res: Response) => {
  try {
    const config = loadConfig();
    const connection = new Connection(config.rpcUrl, "confirmed");
    const slot = await connection.getSlot();
    res.json({ status: "ready", slot });
  } catch (err: unknown) {
    res.status(503).json({ status: "not ready", error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
