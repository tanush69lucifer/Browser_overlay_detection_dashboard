const http = require('http');
const config = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');
const { initSocket } = require('./realtime/io');

async function start() {
  await connectDB();
  const server = http.createServer(app);
  initSocket(server);
  server.listen(config.port, () => console.log(`API + Socket.IO listening on :${config.port}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
