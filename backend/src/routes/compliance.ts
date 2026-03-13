import { Router, Request, Response } from "express";
import { ComplianceService } from "../services/compliance";

const router = Router();
const service = new ComplianceService();

router.post("/api/v1/blacklist", async (req: Request, res: Response) => {
  try {
    const { address, reason } = req.body;

    if (!address || !reason) {
      res.status(400).json({ error: "Missing required fields: address, reason" });
      return;
    }

    const record = await service.addToBlacklist(address, reason);
    res.status(201).json(record);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/api/v1/blacklist/:address", async (req: Request, res: Response) => {
  try {
    await service.removeFromBlacklist(req.params.address);
    res.json({ status: "removed", address: req.params.address });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/api/v1/blacklist", async (_req: Request, res: Response) => {
  const list = service.getBlacklist();
  res.json({ entries: list, count: list.length });
});

router.get("/api/v1/blacklist/:address", async (req: Request, res: Response) => {
  const entry = service.getBlacklistEntry(req.params.address);
  if (!entry) {
    res.json({ blacklisted: false, address: req.params.address });
    return;
  }
  res.json({ blacklisted: true, ...entry });
});

router.get("/api/v1/audit", async (req: Request, res: Response) => {
  const action = req.query.action as string | undefined;
  const limit = parseInt(req.query.limit as string) || 100;
  const records = service.exportAuditTrail();
  res.json({ records: records.slice(0, limit), total: records.length });
});

export default router;
