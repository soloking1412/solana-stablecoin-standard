#!/usr/bin/env node
import { Command } from "commander";
import { registerInitCommand } from "./commands/init";
import { registerMintCommand } from "./commands/mint";
import { registerBurnCommand } from "./commands/burn";
import { registerFreezeCommands } from "./commands/freeze";
import { registerPauseCommands } from "./commands/pause";
import { registerStatusCommand } from "./commands/status";
import { registerBlacklistCommand } from "./commands/blacklist";
import { registerSeizeCommand } from "./commands/seize";
import { registerMintersCommand } from "./commands/minters";
import { registerHoldersCommand } from "./commands/holders";
import { registerRolesCommand } from "./commands/roles";
import { registerAuditCommand } from "./commands/audit";

const program = new Command();

program
  .name("sss-token")
  .description("Solana Stablecoin Standard CLI")
  .version("0.1.0")
  .option("-c, --cluster <cluster>", "Solana cluster", "devnet")
  .option("-k, --keypair <path>", "Path to wallet keypair", "~/.config/solana/id.json")
  .option("--program-id <address>", "Override program ID")
  .option("--mint <address>", "Mint address of the stablecoin");

registerInitCommand(program);
registerMintCommand(program);
registerBurnCommand(program);
registerFreezeCommands(program);
registerPauseCommands(program);
registerStatusCommand(program);
registerBlacklistCommand(program);
registerSeizeCommand(program);
registerMintersCommand(program);
registerHoldersCommand(program);
registerRolesCommand(program);
registerAuditCommand(program);

program.parse();
