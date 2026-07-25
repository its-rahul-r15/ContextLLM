import Redis from "ioredis";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

const createRedisClient = () => {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 10) {
        logger.error("Redis max retries reached");
        return null;
      }
      return Math.min(times * 500, 5000);
    },
  });

  client.on("connect", () => logger.info("Redis connected"));
  client.on("error", (err) => logger.error("Redis error", { err }));
  client.on("close", () => logger.warn("Redis connection closed"));

  return client;
};

export const redisClient = createRedisClient();
