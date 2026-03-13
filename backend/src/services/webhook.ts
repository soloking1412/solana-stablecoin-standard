import { createHmac } from "crypto";
import { store, WebhookRegistration } from "../db/store";
import { logger } from "../logger";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // exponential-ish backoff

export class WebhookService {
  register(url: string, events: string[], secret?: string): WebhookRegistration {
    const wh = store.registerWebhook(url, events, secret);
    logger.info({ id: wh.id, url, events }, "Webhook registered");
    return wh;
  }

  remove(id: string): boolean {
    const removed = store.removeWebhook(id);
    if (removed) logger.info({ id }, "Webhook removed");
    return removed;
  }

  list(): WebhookRegistration[] {
    return store.listWebhooks();
  }

  async dispatch(event: string, data: Record<string, unknown>): Promise<void> {
    const targets = store.getWebhooksForEvent(event);
    if (targets.length === 0) return;

    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });

    for (const wh of targets) {
      this.sendWithRetry(wh, payload, 0).catch((err) => {
        logger.error({ webhookId: wh.id, error: err.message }, "Webhook delivery failed");
      });
    }
  }

  private async sendWithRetry(
    wh: WebhookRegistration,
    payload: string,
    attempt: number
  ): Promise<void> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (wh.secret) {
      const sig = createHmac("sha256", wh.secret).update(payload).digest("hex");
      headers["X-Webhook-Signature"] = sig;
    }

    try {
      const res = await fetch(wh.url, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        return this.sendWithRetry(wh, payload, attempt + 1);
      }

      logger.debug({ webhookId: wh.id, status: res.status }, "Webhook delivered");
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        return this.sendWithRetry(wh, payload, attempt + 1);
      }
      throw err;
    }
  }
}
