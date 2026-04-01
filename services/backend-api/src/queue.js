import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from './config.js';

export const analysisQueueName = 'analysis-jobs';

export function createAnalysisQueue() {
  const connection = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
    enableOfflineQueue: false,
    connectTimeout: 5000,
  });

  /* =========================
     REDIS RUNTIME HARDENING
  ========================= */

  connection.on('error', (err) => {
    console.error('❌ Redis connection error:', err.message);
  });

  connection.on('end', () => {
    console.error('❌ Redis connection closed');
    process.exit(1); // force restart (critical in production)
  });

  connection.on('connect', () => {
    console.log('✅ Redis connected');
  });

  /* =========================
     FAIL-FAST CHECK
  ========================= */

  connection.ping()
    .then((pong) => {
      if (pong !== 'PONG') {
        console.error('❌ Redis ping failed');
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('❌ Redis unavailable:', err.message);
      process.exit(1);
    });

  const queue = new Queue(analysisQueueName, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  /* =========================
     QUEUE ERROR HANDLING
  ========================= */

  queue.on('error', (err) => {
    console.error('❌ Queue error:', err);
    process.exit(1);
  });

  return queue;
}