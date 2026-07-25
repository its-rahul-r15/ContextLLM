import "./config/env.js";
import app from "./app.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { redisClient } from "./config/redis.js";
import { logger } from "./utils/logger.js";
import { env } from "./config/env.js";

import "./jobs/workers/ingestion.worker.js";

const PORT = parseInt(env.PORT, 10) || 5000;

let server;

const start = async () => {
  await connectDB();

  server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} [${env.NODE_ENV}]`);
  });
};

const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server?.close(async () => {
    await disconnectDB();
    await redisClient.quit();
    logger.info("Shutdown complete");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", { err: err.message, stack: err.stack });
  process.exit(1);
});

start();
