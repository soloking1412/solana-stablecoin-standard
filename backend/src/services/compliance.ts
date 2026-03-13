import { store } from "../db/store";
import { logger } from "../logger";

export interface BlacklistRecord {
  address: string;
  reason: string;
  addedAt: Date;
  addedBy: string;
}

export class ComplianceService {
  private blacklist: Map<string, BlacklistRecord> = new Map();

  async addToBlacklist(address: string, reason: string, operator: string = "api"): Promise<BlacklistRecord> {
    if (this.blacklist.has(address)) {
      throw new Error(`Address ${address} is already blacklisted`);
    }

    const record: BlacklistRecord = {
      address,
      reason,
      addedAt: new Date(),
      addedBy: operator,
    };

    this.blacklist.set(address, record);
    store.cacheBlacklist(address);

    store.addAuditRecord({
      action: "blacklist_add",
      actor: operator,
      target: address,
    });

    logger.info({ address, reason }, "Address added to blacklist");
    return record;
  }

  async removeFromBlacklist(address: string, operator: string = "api"): Promise<void> {
    if (!this.blacklist.has(address)) {
      throw new Error(`Address ${address} is not blacklisted`);
    }

    this.blacklist.delete(address);
    store.removeFromBlacklistCache(address);

    store.addAuditRecord({
      action: "blacklist_remove",
      actor: operator,
      target: address,
    });

    logger.info({ address }, "Address removed from blacklist");
  }

  isBlacklisted(address: string): boolean {
    return this.blacklist.has(address);
  }

  getBlacklist(): BlacklistRecord[] {
    return Array.from(this.blacklist.values());
  }

  getBlacklistEntry(address: string): BlacklistRecord | null {
    return this.blacklist.get(address) || null;
  }

  exportAuditTrail(from?: Date, to?: Date) {
    let records = store.getAuditLog({ limit: 1000 });

    if (from) {
      records = records.filter((r) => r.timestamp >= from);
    }
    if (to) {
      records = records.filter((r) => r.timestamp <= to);
    }

    return records;
  }
}
