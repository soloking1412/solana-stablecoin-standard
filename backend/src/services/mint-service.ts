import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { store, MintRequest } from "../db/store";
import { logger } from "../logger";

export class MintService {
  private connection: Connection;

  constructor(rpcUrl: string) {
    this.connection = new Connection(rpcUrl, "confirmed");
  }

  async requestMint(recipient: string, amount: string): Promise<MintRequest> {
    // Validate inputs
    try {
      new PublicKey(recipient);
    } catch {
      throw new Error(`Invalid recipient address: ${recipient}`);
    }

    const parsedAmount = BigInt(amount);
    if (parsedAmount <= 0n) {
      throw new Error("Amount must be positive");
    }

    const request = store.createMintRequest(recipient, amount);
    logger.info({ requestId: request.id, recipient, amount }, "Mint request created");

    // In production, this would go through an approval queue.
    // For the SDK, we execute immediately.
    store.addAuditRecord({
      action: "mint_requested",
      actor: "api",
      target: recipient,
      amount,
    });

    return request;
  }

  async requestBurn(amount: string, tokenAccount?: string): Promise<MintRequest> {
    const parsedAmount = BigInt(amount);
    if (parsedAmount <= 0n) {
      throw new Error("Amount must be positive");
    }

    const request = store.createMintRequest("burn", amount);
    request.status = "pending";
    logger.info({ requestId: request.id, amount }, "Burn request created");

    store.addAuditRecord({
      action: "burn_requested",
      actor: "api",
      target: tokenAccount,
      amount,
    });

    return request;
  }

  getRequest(id: string): MintRequest | null {
    return store.getMintRequest(id);
  }
}
