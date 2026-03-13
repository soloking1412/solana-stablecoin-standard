import { Router, Request, Response } from "express";
import { WebhookService } from "../services/webhook";

const router = Router();
const service = new WebhookService();

router.post("/api/v1/webhooks", async (req: Request, res: Response) => {
  try {
    const { url, events, secret } = req.body;

    if (!url || !events || !Array.isArray(events)) {
      res.status(400).json({
        error: "Missing required fields: url, events (array)",
      });
      return;
    }

    const validEvents = ["mint", "burn", "freeze", "thaw", "pause", "unpause", "blacklist", "seize"];
    const invalid = events.filter((e: string) => !validEvents.includes(e));
    if (invalid.length > 0) {
      res.status(400).json({ error: `Invalid events: ${invalid.join(", ")}` });
      return;
    }

    const wh = service.register(url, events, secret);
    res.status(201).json(wh);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/api/v1/webhooks", async (_req: Request, res: Response) => {
  const webhooks = service.list();
  res.json({ webhooks, count: webhooks.length });
});

router.delete("/api/v1/webhooks/:id", async (req: Request, res: Response) => {
  const removed = service.remove(req.params.id);
  if (!removed) {
    res.status(404).json({ error: "Webhook not found" });
    return;
  }
  res.json({ status: "removed" });
});

export default router;
