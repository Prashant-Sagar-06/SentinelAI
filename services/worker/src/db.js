import mongoose from 'mongoose';
import { config } from './config.js';
import { logger } from './lib/logger.js';

export async function connectMongo() {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(config.mongoUrl, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });
    logger.info('mongo_connected');
  } catch (err) {
    logger.error({ err }, 'mongo_connection_failed');
    process.exit(1);
  }
}
