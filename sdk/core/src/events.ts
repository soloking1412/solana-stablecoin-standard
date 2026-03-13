import { PublicKey } from "@solana/web3.js";

export interface TokenInitializedEvent {
  mint: PublicKey;
  authority: PublicKey;
  name: string;
  symbol: string;
  decimals: number;
  preset: number;
  timestamp: bigint;
}

export interface TokensMintedEvent {
  mint: PublicKey;
  recipient: PublicKey;
  amount: bigint;
  minter: PublicKey;
  totalMinted: bigint;
  timestamp: bigint;
}

export interface TokensBurnedEvent {
  mint: PublicKey;
  from: PublicKey;
  amount: bigint;
  burner: PublicKey;
  totalBurned: bigint;
  timestamp: bigint;
}

export interface AccountFrozenEvent {
  mint: PublicKey;
  account: PublicKey;
  frozenBy: PublicKey;
  timestamp: bigint;
}

export interface AccountThawedEvent {
  mint: PublicKey;
  account: PublicKey;
  thawedBy: PublicKey;
  timestamp: bigint;
}

export interface AddressBlacklistedEvent {
  config: PublicKey;
  address: PublicKey;
  reason: string;
  blacklistedBy: PublicKey;
  timestamp: bigint;
}

export interface TokensSeizedEvent {
  config: PublicKey;
  from: PublicKey;
  to: PublicKey;
  amount: bigint;
  seizedBy: PublicKey;
  timestamp: bigint;
}

export type StablecoinEvent =
  | { type: "TokenInitialized"; data: TokenInitializedEvent }
  | { type: "TokensMinted"; data: TokensMintedEvent }
  | { type: "TokensBurned"; data: TokensBurnedEvent }
  | { type: "AccountFrozen"; data: AccountFrozenEvent }
  | { type: "AccountThawed"; data: AccountThawedEvent }
  | { type: "AddressBlacklisted"; data: AddressBlacklistedEvent }
  | { type: "TokensSeized"; data: TokensSeizedEvent };

export type EventCallback<T = unknown> = (event: T) => void;

export class EventManager {
  private listeners: Map<string, EventCallback[]> = new Map();

  on<T>(eventType: string, callback: EventCallback<T>): () => void {
    const existing = this.listeners.get(eventType) || [];
    existing.push(callback as EventCallback);
    this.listeners.set(eventType, existing);

    return () => {
      const cbs = this.listeners.get(eventType) || [];
      const idx = cbs.indexOf(callback as EventCallback);
      if (idx >= 0) cbs.splice(idx, 1);
    };
  }

  emit<T>(eventType: string, data: T): void {
    const cbs = this.listeners.get(eventType) || [];
    for (const cb of cbs) {
      try {
        cb(data);
      } catch {
        // swallow listener errors
      }
    }
  }

  removeAll(): void {
    this.listeners.clear();
  }
}
