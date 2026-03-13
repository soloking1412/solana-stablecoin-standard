import express from "express";
import cors from "cors";
import helmet from "helmet";
import { loadConfig } from "./config";
import { logger } from "./logger";
import { authMiddleware } from "./middleware/auth";
import { apiLimiter } from "./middleware/rate-limit";
import { IndexerService } from "./services/indexer";

import healthRoutes from "./routes/health";
import mintRoutes from "./routes/mint";
import complianceRoutes from "./routes/compliance";
import statusRoutes from "./routes/status";
import webhookRoutes from "./routes/webhooks";

const config = loadConfig();
const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(apiLimiter);
app.use(authMiddleware);

// Routes
app.use(healthRoutes);
app.use(mintRoutes);
app.use(complianceRoutes);
app.use(statusRoutes);
app.use(webhookRoutes);

// Start indexer
const indexer = new IndexerService(config.rpcUrl, config.programId);
indexer.start().catch((err) => {
  logger.warn({ error: err.message }, "Indexer failed to start — running without event tracking");
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, "SSS Backend started");
});

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutting down...");
  await indexer.stop();
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
