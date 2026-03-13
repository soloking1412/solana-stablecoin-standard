import { expect } from "chai";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  getConfigAddress,
  getRoleAddress,
  getMinterQuotaAddress,
  getBlacklistAddress,
  getExtraAccountMetasAddress,
} from "../src/pda";

const PROGRAM_ID = new PublicKey("StbMVdQRUykc9jS3bT1LCiHBqBos1awkVHFn2cFRLwR");
const HOOK_PROGRAM_ID = new PublicKey("SThk8WNt3JUYTCNwUgMJeLSBbqRbGnFv6xFM4th7giQ");

describe("PDA derivation", () => {
  const mint = Keypair.generate().publicKey;
  const user = Keypair.generate().publicKey;

  it("derives config PDA deterministically", () => {
    const [addr1, bump1] = getConfigAddress(mint, PROGRAM_ID);
    const [addr2, bump2] = getConfigAddress(mint, PROGRAM_ID);
    expect(addr1.toBase58()).to.equal(addr2.toBase58());
    expect(bump1).to.equal(bump2);
  });

  it("derives different config for different mints", () => {
    const mint2 = Keypair.generate().publicKey;
    const [addr1] = getConfigAddress(mint, PROGRAM_ID);
    const [addr2] = getConfigAddress(mint2, PROGRAM_ID);
    expect(addr1.toBase58()).to.not.equal(addr2.toBase58());
  });

  it("derives role PDA with role type", () => {
    const config = Keypair.generate().publicKey;
    const [adminRole] = getRoleAddress(config, 0, user, PROGRAM_ID);
    const [minterRole] = getRoleAddress(config, 1, user, PROGRAM_ID);
    expect(adminRole.toBase58()).to.not.equal(minterRole.toBase58());
  });

  it("derives different role PDA for different users", () => {
    const config = Keypair.generate().publicKey;
    const user2 = Keypair.generate().publicKey;
    const [role1] = getRoleAddress(config, 0, user, PROGRAM_ID);
    const [role2] = getRoleAddress(config, 0, user2, PROGRAM_ID);
    expect(role1.toBase58()).to.not.equal(role2.toBase58());
  });

  it("derives minter quota PDA", () => {
    const config = Keypair.generate().publicKey;
    const [quota1, bump1] = getMinterQuotaAddress(config, user, PROGRAM_ID);
    const [quota2, bump2] = getMinterQuotaAddress(config, user, PROGRAM_ID);
    expect(quota1.toBase58()).to.equal(quota2.toBase58());
    expect(bump1).to.equal(bump2);
  });

  it("derives blacklist PDA", () => {
    const config = Keypair.generate().publicKey;
    const addr = Keypair.generate().publicKey;
    const [bl1] = getBlacklistAddress(config, addr, PROGRAM_ID);
    const [bl2] = getBlacklistAddress(config, addr, PROGRAM_ID);
    expect(bl1.toBase58()).to.equal(bl2.toBase58());
  });

  it("derives extra account metas PDA", () => {
    const [meta1] = getExtraAccountMetasAddress(mint, HOOK_PROGRAM_ID);
    const [meta2] = getExtraAccountMetasAddress(mint, HOOK_PROGRAM_ID);
    expect(meta1.toBase58()).to.equal(meta2.toBase58());
  });

  it("returns valid PublicKey instances", () => {
    const config = Keypair.generate().publicKey;
    const [addr] = getConfigAddress(mint, PROGRAM_ID);
    expect(addr).to.be.instanceOf(PublicKey);
    expect(addr.toBuffer().length).to.equal(32);
  });

  it("returns bump in valid range", () => {
    const [, bump] = getConfigAddress(mint, PROGRAM_ID);
    expect(bump).to.be.at.least(0);
    expect(bump).to.be.at.most(255);
  });

  it("all 7 role types produce unique PDAs for same user", () => {
    const config = Keypair.generate().publicKey;
    const pdas = new Set<string>();
    for (let role = 0; role <= 6; role++) {
      const [pda] = getRoleAddress(config, role, user, PROGRAM_ID);
      pdas.add(pda.toBase58());
    }
    expect(pdas.size).to.equal(7);
  });
});
