import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import ora from "ora";
import { getConnection, loadConfig } from "../utils/config";
import { loadWallet } from "../utils/wallet";
import { printSuccess, printError } from "../utils/display";
import { SolanaStablecoin } from "../../stablecoin";
import { Preset } from "../../types";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a new stablecoin token")
    .option("--preset <preset>", "Preset: sss-1, sss-2, sss-3")
    .option("--name <name>", "Token name")
    .option("--symbol <symbol>", "Token symbol")
    .option("--decimals <decimals>", "Decimal places", "6")
    .option("--uri <uri>", "Metadata URI", "")
    .option("--config <path>", "Path to custom config file (JSON/TOML)")
    .action(async (opts) => {
      const parent = program.opts();
      const spinner = ora("Initializing stablecoin...").start();

      try {
        const connection = getConnection(parent.cluster);
        const authority = loadWallet(parent.keypair);

        let preset = Preset.SSS_1;
        let name = opts.name;
        let symbol = opts.symbol;
        let decimals = parseInt(opts.decimals);
        let uri = opts.uri;

        if (opts.config) {
          const config = loadConfig(opts.config);
          name = config.name;
          symbol = config.symbol;
          decimals = config.decimals ?? 6;
          uri = config.uri ?? "";
          preset = (config.preset ?? 1) as Preset;
        } else if (opts.preset) {
          const presetMap: Record<string, Preset> = {
            "sss-1": Preset.SSS_1,
            "sss-2": Preset.SSS_2,
            "sss-3": Preset.SSS_3,
          };
          preset = presetMap[opts.preset] || Preset.SSS_1;
        }

        if (!name || !symbol) {
          spinner.fail("--name and --symbol are required");
          process.exit(1);
        }

        const stable = await SolanaStablecoin.create(connection, {
          preset,
          name,
          symbol,
          uri,
          decimals,
          authority,
        });

        spinner.stop();
        printSuccess(`Stablecoin initialized!`);
        console.log(`  Mint:    ${stable.mint.toBase58()}`);
        console.log(`  Config:  ${stable.configAddress.toBase58()}`);
        console.log(`  Preset:  SSS-${preset}`);
      } catch (err: unknown) {
        spinner.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
