import { PublicKey, Keypair } from "@solana/web3.js";

export enum Preset {
  SSS_1 = 1,
  SSS_2 = 2,
  SSS_3 = 3,
}

export enum RoleType {
  Admin = 0,
  Minter = 1,
  Burner = 2,
  Freezer = 3,
  Pauser = 4,
  Blacklister = 5,
  Seizer = 6,
}

export interface StablecoinConfig {
  authority: PublicKey;
  mint: PublicKey;
  name: string;
  symbol: string;
  uri: string;
  decimals: number;
  preset: number;
  paused: boolean;
  totalMinted: bigint;
  totalBurned: bigint;
  enablePermanentDelegate: boolean;
  enableTransferHook: boolean;
  defaultAccountFrozen: boolean;
  createdAt: bigint;
  bump: number;
}

export interface RoleAccount {
  config: PublicKey;
  user: PublicKey;
  role: number;
  active: boolean;
  grantedBy: PublicKey;
  grantedAt: bigint;
  bump: number;
}

export interface MinterQuota {
  config: PublicKey;
  minter: PublicKey;
  quota: bigint;
  minted: bigint;
  bump: number;
}

export interface BlacklistEntry {
  config: PublicKey;
  address: PublicKey;
  reason: string;
  blacklistedBy: PublicKey;
  blacklistedAt: bigint;
  bump: number;
}

export interface CreateParams {
  preset?: Preset;
  name: string;
  symbol: string;
  uri?: string;
  decimals?: number;
  authority: Keypair;
  extensions?: {
    permanentDelegate?: boolean;
    transferHook?: boolean;
    defaultAccountFrozen?: boolean;
    confidentialTransfers?: boolean;
  };
}

export interface MintParams {
  recipient: PublicKey;
  amount: bigint | number;
  minter: Keypair;
}

export interface BurnParams {
  tokenAccount: PublicKey;
  amount: bigint | number;
  burner: Keypair;
}

export interface SeizeParams {
  fromAccount: PublicKey;
  toAccount: PublicKey;
  seizer: Keypair;
}

export interface HolderInfo {
  address: PublicKey;
  tokenAccount: PublicKey;
  balance: bigint;
  isFrozen: boolean;
}

export interface AuditLogEntry {
  type: string;
  actor: PublicKey;
  target?: PublicKey;
  amount?: bigint;
  reason?: string;
  timestamp: number;
  signature: string;
}

export interface PresetConfig {
  permanentDelegate: boolean;
  transferHook: boolean;
  defaultAccountFrozen: boolean;
  confidentialTransfers: boolean;
}
