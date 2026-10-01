// Live per-exam counters. Redis when available (shared across instances), in-memory otherwise.
const { redis } = require('../config/redis');

const mem = new Map();
const memExam = (examId) => {
  if (!mem.has(examId)) {
    mem.set(examId, {
      online: new Set(),
      flagged: new Set(),
      unfocused: new Set(),
      sev: { LOW: 0, MED: 0, HIGH: 0 },
    });
  }
  return mem.get(examId);
};
const key = (examId, part) => `exam:${examId}:${part}`;

async function setOnline(examId, sessionId) {
  if (redis) return redis.sadd(key(examId, 'online'), sessionId);
  memExam(examId).online.add(sessionId);
}

async function setOffline(examId, sessionId) {
  if (redis) {
    await redis.multi().srem(key(examId, 'online'), sessionId).srem(key(examId, 'unfocused'), sessionId).exec();
    return;
  }
  const e = memExam(examId);
  e.online.delete(sessionId);
  e.unfocused.delete(sessionId);
}

async function heartbeat(examId, sessionId, focused) {
  if (redis) {
    const tx = redis.multi().sadd(key(examId, 'online'), sessionId);
    if (focused) tx.srem(key(examId, 'unfocused'), sessionId);
    else tx.sadd(key(examId, 'unfocused'), sessionId);
    await tx.exec();
    return;
  }
  const e = memExam(examId);
  e.online.add(sessionId);
  if (focused) e.unfocused.delete(sessionId);
  else e.unfocused.add(sessionId);
}

// Called by the scoring engine every time a flag is raised.
async function markFlagged(examId, sessionId, severity) {
  if (redis) {
    await redis.multi().sadd(key(examId, 'flagged'), sessionId).hincrby(key(examId, 'sev'), severity, 1).exec();
    return;
  }
  const e = memExam(examId);
  e.flagged.add(sessionId);
  e.sev[severity] = (e.sev[severity] || 0) + 1;
}

async function getSummary(examId) {
  if (redis) {
    const res = await redis
      .multi()
      .scard(key(examId, 'online'))
      .scard(key(examId, 'flagged'))
      .scard(key(examId, 'unfocused'))
      .hgetall(key(examId, 'sev'))
      .exec();
    const [online, flagged, unfocused, sev] = res.map(([, value]) => value);
    return {
      online,
      flaggedCount: flagged,
      unfocused,
      bySeverity: { LOW: Number(sev.LOW || 0), MED: Number(sev.MED || 0), HIGH: Number(sev.HIGH || 0) },
    };
  }
  const e = memExam(examId);
  return { online: e.online.size, flaggedCount: e.flagged.size, unfocused: e.unfocused.size, bySeverity: { ...e.sev } };
}

// Wipes all counters for an exam (used by the seed script).
async function resetExam(examId) {
  if (redis) {
    await redis.del(key(examId, 'online'), key(examId, 'flagged'), key(examId, 'unfocused'), key(examId, 'sev'));
    return;
  }
  mem.delete(examId);
}

module.exports = { setOnline, setOffline, heartbeat, markFlagged, getSummary, resetExam };
