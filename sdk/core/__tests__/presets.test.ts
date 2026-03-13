import { expect } from "chai";
import {
  PRESET_CONFIGS,
  PRESET_NAMES,
  PRESET_DESCRIPTIONS,
  getPresetConfig,
  isCompliant,
} from "../src/presets";
import { Preset } from "../src/types";

describe("Preset configurations", () => {
  it("SSS-1 has no compliance features", () => {
    const config = getPresetConfig(Preset.SSS_1);
    expect(config.permanentDelegate).to.be.false;
    expect(config.transferHook).to.be.false;
    expect(config.defaultAccountFrozen).to.be.false;
    expect(config.confidentialTransfers).to.be.false;
  });

  it("SSS-2 has compliance but no confidential transfers", () => {
    const config = getPresetConfig(Preset.SSS_2);
    expect(config.permanentDelegate).to.be.true;
    expect(config.transferHook).to.be.true;
    expect(config.defaultAccountFrozen).to.be.true;
    expect(config.confidentialTransfers).to.be.false;
  });

  it("SSS-3 has confidential transfers but no transfer hook", () => {
    const config = getPresetConfig(Preset.SSS_3);
    expect(config.permanentDelegate).to.be.true;
    expect(config.transferHook).to.be.false;
    expect(config.defaultAccountFrozen).to.be.true;
    expect(config.confidentialTransfers).to.be.true;
  });

  it("isCompliant returns false for SSS-1", () => {
    expect(isCompliant(Preset.SSS_1)).to.be.false;
  });

  it("isCompliant returns true for SSS-2", () => {
    expect(isCompliant(Preset.SSS_2)).to.be.true;
  });

  it("isCompliant returns true for SSS-3", () => {
    expect(isCompliant(Preset.SSS_3)).to.be.true;
  });

  it("all presets have names", () => {
    expect(PRESET_NAMES[Preset.SSS_1]).to.include("Minimal");
    expect(PRESET_NAMES[Preset.SSS_2]).to.include("Compliant");
    expect(PRESET_NAMES[Preset.SSS_3]).to.include("Private");
  });

  it("all presets have descriptions", () => {
    expect(PRESET_DESCRIPTIONS[Preset.SSS_1].length).to.be.greaterThan(10);
    expect(PRESET_DESCRIPTIONS[Preset.SSS_2].length).to.be.greaterThan(10);
    expect(PRESET_DESCRIPTIONS[Preset.SSS_3].length).to.be.greaterThan(10);
  });

  it("preset configs are unique", () => {
    const c1 = JSON.stringify(PRESET_CONFIGS[Preset.SSS_1]);
    const c2 = JSON.stringify(PRESET_CONFIGS[Preset.SSS_2]);
    const c3 = JSON.stringify(PRESET_CONFIGS[Preset.SSS_3]);
    expect(c1).to.not.equal(c2);
    expect(c2).to.not.equal(c3);
    expect(c1).to.not.equal(c3);
  });

  it("preset enum values are sequential", () => {
    expect(Preset.SSS_1).to.equal(1);
    expect(Preset.SSS_2).to.equal(2);
    expect(Preset.SSS_3).to.equal(3);
  });
});
