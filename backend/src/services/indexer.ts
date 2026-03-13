import { Connection, PublicKey, Logs } from "@solana/web3.js";
import { logger } from "../logger";
import { store } from "../db/store";

export class IndexerService {
  private connection: Connection;
  private programId: PublicKey;
  private subscriptionId: number | null = null;
  private lastSlot: number = 0;

  constructor(rpcUrl: string, programId: string) {
    this.connection = new Connection(rpcUrl, "confirmed");
    this.programId = new PublicKey(programId);
  }

  async start(): Promise<void> {
    logger.info("Starting event indexer...");

    this.subscriptionId = this.connection.onLogs(
      this.programId,
      (logs: Logs) => {
        this.processLogs(logs);
      },
      "confirmed"
    );

    logger.info({ programId: this.programId.toBase58() }, "Indexer listening for events");
  }

  private processLogs(logs: Logs): void {
    if (logs.err) return;

    for (const log of logs.logs) {
      // Anchor events are base64-encoded after "Program data:" prefix
      if (log.startsWith("Program data:")) {
        try {
          const data = log.slice("Program data: ".length);
          this.handleEvent(data, logs.signature);
        } catch {
          // Skip unparseable events
        }
      }
    }
  }

  private handleEvent(data: string, signature: string): void {
    // Decode anchor event discriminator from first 8 bytes
    const decoded = Buffer.from(data, "base64");
    if (decoded.length < 8) return;

    const disc = decoded.slice(0, 8).toString("hex");
    logger.debug({ discriminator: disc, signature }, "Event received");

    store.addAuditRecord({
      action: "on_chain_event",
      actor: "indexer",
      txSignature: signature,
    });
  }

  async stop(): Promise<void> {
    if (this.subscriptionId !== null) {
      await this.connection.removeOnLogsListener(this.subscriptionId);
      this.subscriptionId = null;
      logger.info("Indexer stopped");
    }
  }
}
