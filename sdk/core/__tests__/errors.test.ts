import { expect } from "chai";
import { StablecoinSdkError, parseAnchorError } from "../src/errors";

describe("Error handling", () => {
  it("creates StablecoinSdkError with message and code", () => {
    const err = new StablecoinSdkError("test error", 6000);
    expect(err.message).to.equal("test error");
    expect(err.code).to.equal(6000);
    expect(err.name).to.equal("StablecoinSdkError");
  });

  it("parses anchor error format", () => {
    const anchorErr = {
      error: {
        errorCode: { number: 6000, code: "Paused" },
        errorMessage: "Token operations are currently paused",
      },
    };
    const parsed = parseAnchorError(anchorErr);
    expect(parsed.code).to.equal(6000);
    expect(parsed.message).to.equal("Token operations are currently paused");
  });

  it("parses custom program error from message", () => {
    const err = { message: "custom program error: 0x1770" };
    const parsed = parseAnchorError(err);
    expect(parsed.code).to.equal(6000);
  });

  it("returns existing StablecoinSdkError unchanged", () => {
    const original = new StablecoinSdkError("original", 42);
    const parsed = parseAnchorError(original);
    expect(parsed).to.equal(original);
  });

  it("handles unknown error shape", () => {
    const parsed = parseAnchorError({});
    expect(parsed).to.be.instanceOf(StablecoinSdkError);
  });

  it("handles null/undefined", () => {
    const parsed = parseAnchorError(null);
    expect(parsed).to.be.instanceOf(StablecoinSdkError);
  });

  it("maps all known error codes", () => {
    const knownCodes = [6000, 6001, 6002, 6003, 6004, 6005, 6006, 6007];
    for (const code of knownCodes) {
      const hex = code.toString(16);
      const err = { message: `custom program error: 0x${hex}` };
      const parsed = parseAnchorError(err);
      expect(parsed.code).to.equal(code);
      expect(parsed.message.length).to.be.greaterThan(5);
    }
  });

  it("handles error with string message only", () => {
    const err = { message: "some random error without program error" };
    const parsed = parseAnchorError(err);
    expect(parsed.message).to.equal("some random error without program error");
  });
});
