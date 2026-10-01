const http = require('http');
const mongoose = require('mongoose');
const config = require('./config/env');
const connectDB = require('./config/db');
const { redis } = require('./config/redis');
const app = require('./app');
const { initSocket } = require('./realtime/io');

const SHUTDOWN_TIMEOUT_MS = 10000;

// Flush flags still sitting in the scoring buffer so a deploy/restart never loses them.
async function flushPendingFlags() {
  try {
    const writer = require('./scoring/flagWriter');
    if (typeof writer.flush === 'function') await writer.flush();
  } catch (err) {
    console.error('Flag flush on shutdown failed:', err.message);
  }
}

async function start() {
  await connectDB();
  const server = http.createServer(app);
  const io = initSocket(server);
  server.listen(config.port, () => console.log(`API + Socket.IO listening on :${config.port}`));

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received: shutting down gracefully`);
    const force = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
    force.unref();

    try {
      await new Promise((resolve) => io.close(() => resolve())); // stops new sockets + closes HTTP server
      await flushPendingFlags();
      await mongoose.disconnect();
      if (redis) await redis.quit();
      clearTimeout(force);
      process.exit(0);
    } catch (err) {
      console.error('Graceful shutdown failed:', err.message);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM')); // Render/Railway send SIGTERM on redeploy
  process.on('SIGINT', () => shutdown('SIGINT')); // Ctrl+C locally
}

process.on('unhandledRejection', (err) => console.error('Unhandled promise rejection:', err));

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
