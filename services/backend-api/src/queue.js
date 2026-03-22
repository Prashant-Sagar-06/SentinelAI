import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from './config.js';

export const analysisQueueName = 'analysis-jobs';

export function createAnalysisQueue() {
  // BullMQ should use a Redis URL directly (single source of truth).
  // Avoid host/port parsing to keep behavior consistent across deployments.
  const connection = new Redis(config.redisUrl, {
    // BullMQ recommendation: disable per-command retry limit.
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  return new Queue(analysisQueueName, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });
}
