import { Router, Request, Response } from "express";
import { MintService } from "../services/mint-service";
import { loadConfig } from "../config";

const router = Router();
const service = new MintService(loadConfig().rpcUrl);

router.post("/api/v1/mint", async (req: Request, res: Response) => {
  try {
    const { recipient, amount, memo } = req.body;

    if (!recipient || !amount) {
      res.status(400).json({ error: "Missing required fields: recipient, amount" });
      return;
    }

    const request = await service.requestMint(recipient, amount.toString());
    res.status(201).json({
      id: request.id,
      status: request.status,
      recipient,
      amount: amount.toString(),
    });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/api/v1/burn", async (req: Request, res: Response) => {
  try {
    const { amount, tokenAccount } = req.body;

    if (!amount) {
      res.status(400).json({ error: "Missing required field: amount" });
      return;
    }

    const request = await service.requestBurn(amount.toString(), tokenAccount);
    res.status(201).json({
      id: request.id,
      status: request.status,
      amount: amount.toString(),
    });
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/api/v1/mint/:id", async (req: Request, res: Response) => {
  const request = service.getRequest(req.params.id);
  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  res.json(request);
});

export default router;
