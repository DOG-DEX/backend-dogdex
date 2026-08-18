import { createClient } from 'redis';
import { logger } from './logger.util';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const isRedisDisabled = process.env.USE_REDIS === 'false';
const redisUrl = process.env.REDIS_URL as string;

let client: ReturnType<typeof createClient> | null = null;

if (isRedisDisabled) {
  logger.info('[Redis] Redis is disabled via USE_REDIS=false.');
} else if (!redisUrl) {
  logger.warn('REDIS_URL is not defined. Guest token limiter will not work.');
} else {
  client = createClient({
    url: redisUrl,
  });

  client.on('connect', () => {});

  client.on('ready', () => {
    logger.info('[Redis] Connection on ' + redisUrl);
  });

  client.on('error', (err) => {
    logger.error('[Redis] Redis Client Error', err);
  });

  client.connect();
}

export const redisClient = client;
