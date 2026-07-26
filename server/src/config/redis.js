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

let clientInstance = null;

const getRedisClient = () => {
  if (!clientInstance) {
    clientInstance = createRedisClient();
  }
  return clientInstance;
};

// Export redisClient as a Proxy to lazy-load the connection on first access (transparently resolves serverless pool exhaustion)
export const redisClient = new Proxy({}, {
  get(target, prop) {
    if (prop === "then") return undefined; // Avoid promise resolution traps
    const client = getRedisClient();
    const value = client[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
  set(target, prop, value) {
    const client = getRedisClient();
    client[prop] = value;
    return true;
  }
});
