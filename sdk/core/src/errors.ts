export class StablecoinSdkError extends Error {
  public code: number;
  public programError?: string;

  constructor(message: string, code: number = 0, programError?: string) {
    super(message);
    this.name = "StablecoinSdkError";
    this.code = code;
    this.programError = programError;
  }
}

const ERROR_MAP: Record<number, string> = {
  6000: "Token operations are currently paused",
  6001: "Token operations are not paused",
  6002: "Amount must be greater than zero",
  6003: "Minting would exceed the assigned quota",
  6004: "Unauthorized: missing required role",
  6005: "Role account is not active",
  6006: "Invalid role type",
  6007: "Compliance features are not enabled for this token",
  6008: "Address is already blacklisted",
  6009: "Address is not blacklisted",
  6010: "Address is blacklisted and cannot transact",
  6011: "Cannot remove the last admin",
  6012: "Name exceeds maximum length",
  6013: "Symbol exceeds maximum length",
  6014: "URI exceeds maximum length",
  6015: "Reason exceeds maximum length",
  6016: "Invalid preset value",
  6017: "Account is not frozen",
  6018: "Account is already frozen",
  6019: "Arithmetic overflow",
  6020: "Authority mismatch",
  6021: "Mint mismatch",
  6022: "Cannot grant compliance roles on non-compliant token",
  6023: "Cannot seize from a non-frozen account",
  6024: "New authority cannot be the zero address",
  6025: "Token account has insufficient balance for seizure",
};

export function parseAnchorError(err: unknown): StablecoinSdkError {
  if (err instanceof StablecoinSdkError) return err;

  const errObj = err as Record<string, any>;

  // Anchor error format
  if (errObj?.error?.errorCode?.number) {
    const code = errObj.error.errorCode.number as number;
    const msg = ERROR_MAP[code] || errObj.error.errorMessage || "Unknown error";
    return new StablecoinSdkError(msg as string, code);
  }

  // Transaction simulation error
  if (typeof errObj?.message === "string") {
    const match = errObj.message.match(/custom program error: 0x([0-9a-fA-F]+)/);
    if (match) {
      const code = parseInt(match[1], 16);
      const msg = ERROR_MAP[code] || `Program error ${code}`;
      return new StablecoinSdkError(msg, code);
    }
    return new StablecoinSdkError(errObj.message);
  }

  return new StablecoinSdkError("Unknown error occurred");
}
