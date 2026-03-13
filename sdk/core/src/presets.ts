import { Preset, PresetConfig } from "./types";

export const PRESET_CONFIGS: Record<Preset, PresetConfig> = {
  [Preset.SSS_1]: {
    permanentDelegate: false,
    transferHook: false,
    defaultAccountFrozen: false,
    confidentialTransfers: false,
  },
  [Preset.SSS_2]: {
    permanentDelegate: true,
    transferHook: true,
    defaultAccountFrozen: true,
    confidentialTransfers: false,
  },
  [Preset.SSS_3]: {
    permanentDelegate: true,
    transferHook: false,
    defaultAccountFrozen: true,
    confidentialTransfers: true,
  },
};

export const PRESET_NAMES: Record<Preset, string> = {
  [Preset.SSS_1]: "SSS-1 Minimal Stablecoin",
  [Preset.SSS_2]: "SSS-2 Compliant Stablecoin",
  [Preset.SSS_3]: "SSS-3 Private Stablecoin",
};

export const PRESET_DESCRIPTIONS: Record<Preset, string> = {
  [Preset.SSS_1]:
    "Mint + freeze + metadata. For internal tokens, DAO treasuries, ecosystem settlement.",
  [Preset.SSS_2]:
    "SSS-1 + permanent delegate + transfer hook + blacklist. For regulated USDC/USDT-class tokens.",
  [Preset.SSS_3]:
    "SSS-1 + confidential transfers + allowlists. Privacy-preserving stablecoin (experimental).",
};

export function getPresetConfig(preset: Preset): PresetConfig {
  return PRESET_CONFIGS[preset];
}

export function isCompliant(preset: Preset): boolean {
  return preset >= Preset.SSS_2;
}
