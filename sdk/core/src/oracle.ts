import { Connection, PublicKey } from "@solana/web3.js";

export interface PriceFeedData {
  price: number;
  confidence: number;
  exponent: number;
  lastUpdated: number;
}

export interface OracleHelperConfig {
  maxStalenessSecs: number;
  maxConfidencePct: number;
}

const DEFAULT_CONFIG: OracleHelperConfig = {
  maxStalenessSecs: 60,
  maxConfidencePct: 2.0,
};

export class OracleHelper {
  private connection: Connection;
  private config: OracleHelperConfig;

  constructor(connection: Connection, config?: Partial<OracleHelperConfig>) {
    this.connection = connection;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Parse a Pyth price feed account. Simplified for devnet/testing —
   * production usage should use @pythnetwork/client.
   */
  async getPrice(feedAddress: PublicKey): Promise<PriceFeedData> {
    const info = await this.connection.getAccountInfo(feedAddress);
    if (!info) throw new Error(`Price feed not found: ${feedAddress.toBase58()}`);

    // Pyth v2 price account layout (simplified)
    const data = info.data;
    const price = Number(data.readBigInt64LE(208));
    const confidence = Number(data.readBigUInt64LE(216));
    const exponent = data.readInt32LE(20);
    const lastUpdated = Number(data.readBigInt64LE(224));

    return { price, confidence, exponent, lastUpdated };
  }

  validatePrice(feed: PriceFeedData): void {
    if (feed.price <= 0) {
      throw new Error("Negative or zero price");
    }

    const now = Math.floor(Date.now() / 1000);
    const age = now - feed.lastUpdated;
    if (age > this.config.maxStalenessSecs) {
      throw new Error(`Price is stale (${age}s old, max ${this.config.maxStalenessSecs}s)`);
    }

    const confPct = (feed.confidence / Math.abs(feed.price)) * 100;
    if (confPct > this.config.maxConfidencePct) {
      throw new Error(
        `Confidence too wide (${confPct.toFixed(2)}%, max ${this.config.maxConfidencePct}%)`
      );
    }
  }

  calculateMintAmount(
    fiatAmount: number,
    feed: PriceFeedData,
    tokenDecimals: number
  ): bigint {
    if (feed.price <= 0) throw new Error("Invalid price");

    const scale = Math.pow(10, Math.abs(feed.exponent));
    const tokenScale = Math.pow(10, tokenDecimals);
    const tokens = (fiatAmount * feed.price * tokenScale) / scale;
    return BigInt(Math.floor(tokens));
  }

  calculateRedeemAmount(
    tokenAmount: bigint,
    feed: PriceFeedData,
    tokenDecimals: number
  ): number {
    if (feed.price <= 0) throw new Error("Invalid price");

    const scale = Math.pow(10, Math.abs(feed.exponent));
    const tokenScale = Math.pow(10, tokenDecimals);
    return (Number(tokenAmount) * scale) / (feed.price * tokenScale);
  }
}
