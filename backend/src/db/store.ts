import { v4 as uuid } from "uuid";

export interface MintRequest {
  id: string;
  recipient: string;
  amount: string;
  status: "pending" | "processing" | "completed" | "failed";
  txSignature?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface WebhookRegistration {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  createdAt: Date;
  active: boolean;
}

export interface AuditRecord {
  id: string;
  action: string;
  actor: string;
  target?: string;
  amount?: string;
  txSignature?: string;
  timestamp: Date;
}

class Store {
  private mintRequests: Map<string, MintRequest> = new Map();
  private webhooks: Map<string, WebhookRegistration> = new Map();
  private auditLog: AuditRecord[] = [];
  private blacklistCache: Set<string> = new Set();

  // Mint requests
  createMintRequest(recipient: string, amount: string): MintRequest {
    const req: MintRequest = {
      id: uuid(),
      recipient,
      amount,
      status: "pending",
      createdAt: new Date(),
    };
    this.mintRequests.set(req.id, req);
    return req;
  }

  updateMintRequest(id: string, update: Partial<MintRequest>): MintRequest | null {
    const req = this.mintRequests.get(id);
    if (!req) return null;
    Object.assign(req, update);
    return req;
  }

  getMintRequest(id: string): MintRequest | null {
    return this.mintRequests.get(id) || null;
  }

  // Webhooks
  registerWebhook(url: string, events: string[], secret?: string): WebhookRegistration {
    const wh: WebhookRegistration = {
      id: uuid(),
      url,
      events,
      secret,
      createdAt: new Date(),
      active: true,
    };
    this.webhooks.set(wh.id, wh);
    return wh;
  }

  removeWebhook(id: string): boolean {
    return this.webhooks.delete(id);
  }

  listWebhooks(): WebhookRegistration[] {
    return Array.from(this.webhooks.values());
  }

  getWebhooksForEvent(event: string): WebhookRegistration[] {
    return this.listWebhooks().filter(
      (wh) => wh.active && wh.events.includes(event)
    );
  }

  // Audit log
  addAuditRecord(record: Omit<AuditRecord, "id" | "timestamp">): AuditRecord {
    const entry: AuditRecord = {
      ...record,
      id: uuid(),
      timestamp: new Date(),
    };
    this.auditLog.push(entry);
    return entry;
  }

  getAuditLog(opts?: { action?: string; limit?: number }): AuditRecord[] {
    let log = [...this.auditLog].reverse();
    if (opts?.action) {
      log = log.filter((r) => r.action === opts.action);
    }
    return log.slice(0, opts?.limit || 100);
  }

  // Blacklist cache
  cacheBlacklist(address: string): void {
    this.blacklistCache.add(address);
  }

  removeFromBlacklistCache(address: string): void {
    this.blacklistCache.delete(address);
  }

  isBlacklistedCached(address: string): boolean {
    return this.blacklistCache.has(address);
  }
}

export const store = new Store();
