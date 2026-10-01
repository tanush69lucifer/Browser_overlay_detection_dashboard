// Debounce mechanism for persistent overlay signals (e.g. stationary fixed DOM elements)
// Uses Redis atomic SET key 1 NX EX ttl, or an in-memory Map with expiration.

const { redis } = require('../config/redis');

const memDebounce = new Map();

// Periodic purge of expired entries in memory fallback
setInterval(() => {
  const now = Date.now();
  for (const [k, expiresAt] of memDebounce.entries()) {
    if (now >= expiresAt) {
      memDebounce.delete(k);
    }
  }
}, 60 * 1000).unref();

/**
 * Checks whether a signal should be counted or skipped due to debouncing.
 * TTL is 60 seconds for keyed signals, 10 seconds for keyless ones.
 *
 * @param {string} sessionId
 * @param {string} code
 * @param {string|null|undefined} key
 * @returns {Promise<boolean>} - true if signal should be counted, false if debounced
 */
async function shouldCount(sessionId, code, key) {
  const hasKey = key !== undefined && key !== null && String(key).trim() !== '';
  const cleanKey = hasKey ? String(key).trim() : 'none';
  const ttl = hasKey ? 60 : 10;
  const redisKey = `debounce:${sessionId}:${code}:${cleanKey}`;

  if (redis) {
    try {
      const res = await redis.set(redisKey, '1', 'EX', ttl, 'NX');
      return res === 'OK';
    } catch (err) {
      console.error('Redis debounce error, falling back to memory:', err.message);
    }
  }

  // In-memory fallback
  const now = Date.now();
  const expiresAt = memDebounce.get(redisKey);

  if (expiresAt && now < expiresAt) {
    return false;
  }

  memDebounce.set(redisKey, now + ttl * 1000);
  return true;
}

/**
 * Clears in-memory debounce entries (useful for testing).
 */
function clearDebounce() {
  memDebounce.clear();
}

module.exports = {
  shouldCount,
  clearDebounce,
};
