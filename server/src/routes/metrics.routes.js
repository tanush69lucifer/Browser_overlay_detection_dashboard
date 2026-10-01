// OWNER: Tanush. Admin-only runtime metrics, used to observe the server during load tests.
const os = require('os');
const mongoose = require('mongoose');
const router = require('express').Router();
const { requireAuth, requireRole } = require('../middlewares/auth');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const { redis } = require('../config/redis');
const { getIO } = require('../realtime/io');

const MONGO_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
const mb = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;

router.get(
  '/admin/metrics',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const io = getIO();
    const mem = process.memoryUsage();

    let redisPingMs = null;
    if (redis && redis.status === 'ready') {
      const t = Date.now();
      await redis.ping();
      redisPingMs = Date.now() - t;
    }

    ok(res, {
      uptimeSec: Math.round(process.uptime()),
      node: process.version,
      pid: process.pid,
      sockets: io ? io.engine.clientsCount : 0,
      memoryMb: { rss: mb(mem.rss), heapUsed: mb(mem.heapUsed), heapTotal: mb(mem.heapTotal) },
      cpu: { cores: os.cpus().length, loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100) },
      mongo: MONGO_STATES[mongoose.connection.readyState] || 'unknown',
      redis: { status: redis ? redis.status : 'disabled', pingMs: redisPingMs, adapter: Boolean(redis) },
    });
  })
);

module.exports = router;
