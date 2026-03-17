import { Queue } from 'bullmq';
import { config } from './config.js';
import { redisConnectionFromUrl } from './redis.js';

export const analysisQueueName = 'analysis-jobs';

export function createAnalysisQueue() {
  return new Queue(analysisQueueName, {
    connection: {
      ...redisConnectionFromUrl(config.redisUrl),
    },
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });
}
