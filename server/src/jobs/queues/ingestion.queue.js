import { Queue } from "bullmq";
import { redisClient } from "../../config/redis.js";
import Redis from "ioredis";
import { env } from "../../config/env.js";

let queueInstance = null;

const getIngestionQueue = () => {
  if (!queueInstance) {
    queueInstance = new Queue("ingestion", {
      connection: redisClient,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return queueInstance;
};

// Export ingestionQueue as a Proxy for the worker (keeps persistent connection)
export const ingestionQueue = new Proxy({}, {
  get(target, prop) {
    const queue = getIngestionQueue();
    const value = queue[prop];
    if (typeof value === "function") {
      return value.bind(queue);
    }
    return value;
  }
});

/**
 * Add a job to the ingestion queue.
 * In serverless environments, this creates a short-lived one-off connection
 * and immediately closes it to prevent connection leaks.
 */
export const addIngestionJob = async (data, options = {}) => {
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const queue = new Queue("ingestion", {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });

  try {
    return await queue.add("parse", data, {
      jobId: `parse_${data.sourceId}`,
      ...options,
    });
  } finally {
    await queue.close();
    await connection.quit().catch(() => {});
  }
};
