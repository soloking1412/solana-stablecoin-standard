import { expect } from "chai";
import { Keypair, PublicKey } from "@solana/web3.js";
import { formatAmount, parseAmount, shortenAddress } from "../src/utils";

describe("Utility functions", () => {
  describe("formatAmount", () => {
    it("formats whole number correctly", () => {
      expect(formatAmount(1_000_000n, 6)).to.equal("1");
    });

    it("formats fractional amounts", () => {
      expect(formatAmount(1_500_000n, 6)).to.equal("1.5");
    });

    it("formats zero", () => {
      expect(formatAmount(0n, 6)).to.equal("0");
    });

    it("formats small amounts", () => {
      expect(formatAmount(1n, 6)).to.equal("0.000001");
    });

    it("formats large amounts", () => {
      expect(formatAmount(1_000_000_000_000n, 6)).to.equal("1000000");
    });

    it("accepts number input", () => {
      expect(formatAmount(1_000_000, 6)).to.equal("1");
    });

    it("handles different decimal places", () => {
      expect(formatAmount(100n, 2)).to.equal("1");
      expect(formatAmount(1_000_000_000n, 9)).to.equal("1");
    });
  });

  describe("parseAmount", () => {
    it("parses whole numbers", () => {
      expect(parseAmount("1", 6)).to.equal(1_000_000n);
    });

    it("parses fractional amounts", () => {
      expect(parseAmount("1.5", 6)).to.equal(1_500_000n);
    });

    it("parses zero", () => {
      expect(parseAmount("0", 6)).to.equal(0n);
    });

    it("truncates extra decimal places", () => {
      expect(parseAmount("1.1234567890", 6)).to.equal(1_123_456n);
    });

    it("pads short decimals", () => {
      expect(parseAmount("1.1", 6)).to.equal(1_100_000n);
    });

    it("roundtrip formatAmount -> parseAmount", () => {
      const original = 1_234_567n;
      const formatted = formatAmount(original, 6);
      const parsed = parseAmount(formatted, 6);
      expect(parsed).to.equal(original);
    });
  });

  describe("shortenAddress", () => {
    it("shortens a pubkey", () => {
      const pk = Keypair.generate().publicKey;
      const short = shortenAddress(pk);
      expect(short).to.include("...");
      expect(short.length).to.be.lessThan(pk.toBase58().length);
    });

    it("accepts string input", () => {
      const short = shortenAddress("11111111111111111111111111111111");
      expect(short).to.include("...");
    });

    it("uses custom character count", () => {
      const pk = Keypair.generate().publicKey;
      const short = shortenAddress(pk, 8);
      const parts = short.split("...");
      expect(parts[0].length).to.equal(8);
      expect(parts[1].length).to.equal(8);
    });
  });
});
