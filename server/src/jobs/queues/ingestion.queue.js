import { Queue } from "bullmq";
import { redisClient } from "../../config/redis.js";

const connection = redisClient;

export const ingestionQueue = new Queue("ingestion", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

/**
 * Add a job to the ingestion queue.
 *
 * @param {object} data       — job payload
 * @param {object} [options]  — optional BullMQ job options to override defaults
 *                              e.g. { attempts: 2, backoff: { type: 'fixed', delay: 5000 } }
 *                              Used by weblink jobs (lower retry budget than YouTube/PDF).
 */
export const addIngestionJob = async (data, options = {}) => {
  return ingestionQueue.add("parse", data, {
    jobId: `parse_${data.sourceId}`,
    ...options,
  });
};
