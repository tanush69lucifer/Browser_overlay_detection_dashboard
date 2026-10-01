const Redis = require('ioredis');
const config = require('./env');

// `redis` is null when REDIS_URL is empty. Every Redis consumer must have an in-memory fallback.
let redis = null;

if (config.redisUrl) {
  redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  redis.on('connect', () => console.log('Redis connected'));
  redis.on('error', (err) => console.error('Redis error:', err.message));
} else {
  console.warn('REDIS_URL not set: single instance mode with in-memory counters');
}

module.exports = { redis };
