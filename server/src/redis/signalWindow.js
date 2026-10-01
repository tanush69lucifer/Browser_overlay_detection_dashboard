// Sliding signal window per session using Redis sorted set (ZSET)
// or an in-memory Map fallback when Redis is null.
// Tracks accumulated signal weights within windowMs.

const { redis } = require('../config/redis');

const memWindows = new Map();

const key = (sessionId) => `win:${sessionId}`;

/**
 * Adds signal entries to the sliding window, trims entries older than windowMs,
 * and returns the sum of weights and whether any MED severity signal is present.
 *
 * @param {string} sessionId
 * @param {Array<{ weight: number, severity: string, t?: number }>} entries
 * @param {number} windowMs - Window duration in milliseconds
 * @returns {Promise<{ sum: number, hasMed: boolean }>}
 */
async function add(sessionId, entries = [], windowMs = 60000) {
  const now = Date.now();
  const cutoff = now - windowMs;

  if (redis) {
    try {
      const zKey = key(sessionId);
      const tx = redis.multi();

      if (Array.isArray(entries) && entries.length > 0) {
        const zaddArgs = [];
        for (const entry of entries) {
          const t = Number(entry.t) || now;
          const rand = Math.random().toString(36).slice(2, 8);
          const weight = Number(entry.weight) || 0;
          const severity = entry.severity || 'LOW';
          // member format: ${t}:${random}:${weight}:${severity}
          const member = `${t}:${rand}:${weight}:${severity}`;
          zaddArgs.push(t, member);
        }
        tx.zadd(zKey, ...zaddArgs);
      }

      // Trim elements older than cutoff
      tx.zremrangebyscore(zKey, '-inf', cutoff);
      // Retrieve remaining elements in current window
      tx.zrangebyscore(zKey, cutoff, '+inf');
      // Set TTL to twice the window to prevent leaks
      tx.expire(zKey, Math.max(60, Math.ceil((windowMs * 2) / 1000)));

      const results = await tx.exec();
      // zrangebyscore result is at index 2 if zadd was called, or index 1 if not
      const rangeResultIndex = entries.length > 0 ? 2 : 1;
      const members = results[rangeResultIndex] ? results[rangeResultIndex][1] : [];

      let sum = 0;
      let hasMed = false;

      if (Array.isArray(members)) {
        for (const member of members) {
          const parts = String(member).split(':');
          if (parts.length >= 4) {
            const w = Number(parts[2]) || 0;
            const sev = parts[3];
            sum += w;
            if (sev === 'MED') hasMed = true;
          }
        }
      }

      return { sum, hasMed };
    } catch (err) {
      console.error('Redis signalWindow error, falling back to in-memory:', err.message);
    }
  }

  // In-memory fallback
  let items = memWindows.get(sessionId) || [];
  // Trim old items
  items = items.filter((item) => item.t >= cutoff);

  if (Array.isArray(entries) && entries.length > 0) {
    for (const entry of entries) {
      items.push({
        t: Number(entry.t) || now,
        weight: Number(entry.weight) || 0,
        severity: entry.severity || 'LOW',
      });
    }
  }

  memWindows.set(sessionId, items);

  let sum = 0;
  let hasMed = false;
  for (const item of items) {
    sum += item.weight;
    if (item.severity === 'MED') hasMed = true;
  }

  return { sum, hasMed };
}

/**
 * Clears the sliding window for a session (e.g. after raising a window-based flag).
 *
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
async function clear(sessionId) {
  if (redis) {
    try {
      await redis.del(key(sessionId));
    } catch (err) {
      console.error('Redis signalWindow.clear error:', err.message);
    }
  }
  memWindows.delete(sessionId);
}

module.exports = { add, clear };
