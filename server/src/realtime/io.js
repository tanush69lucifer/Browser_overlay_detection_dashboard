const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const config = require('../config/env');
const { redis } = require('../config/redis');
const { verifyToken } = require('../utils/token');
const Session = require('../models/Session');
const Exam = require('../models/Exam');
const counters = require('../redis/counters');
const { processBatch } = require('../scoring/score');

const MAX_SIGNALS_PER_BATCH = 50;
const SUMMARY_INTERVAL_MS = 5000;

let io = null;
const watchedExams = new Set();

const examRoom = (examId) => `exam:${examId}`;
const asAck = (ack) => (typeof ack === 'function' ? ack : () => {});

// Used by REST controllers to push events to proctors of an exam.
function emitToExam(examId, event, payload) {
  if (io) io.to(examRoom(String(examId))).emit(event, payload);
}

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.clientUrl, credentials: true },
    maxHttpBufferSize: 64 * 1024, // tiny payloads only: codes + numbers, never HTML
    pingInterval: 20000,
    pingTimeout: 20000,
  });

  // Redis adapter lets multiple server instances share rooms/broadcasts.
  if (redis) {
    io.adapter(createAdapter(redis.duplicate(), redis.duplicate()));
    console.log('Socket.IO Redis adapter enabled');
  }

  // Every socket must carry a valid JWT: io(url, { auth: { token } })
  io.use((socket, next) => {
    try {
      const payload = verifyToken(socket.handshake.auth?.token);
      socket.data.user = { id: payload.sub, role: payload.role, name: payload.name };
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;

    // Candidate: attach this socket to its monitored session (re-sent on every reconnect).
    socket.on('session:join', async (payload = {}, ack) => {
      const reply = asAck(ack);
      try {
        if (user.role !== 'CANDIDATE') return reply({ ok: false, error: 'FORBIDDEN' });
        const session = await Session.findOne({ _id: payload.sessionId, candidateId: user.id }).lean();
        if (!session || session.status === 'ENDED') return reply({ ok: false, error: 'SESSION_NOT_ACTIVE' });

        const sessionId = String(session._id);
        const examId = String(session.examId);
        Object.assign(socket.data, { sessionId, examId, focused: true });
        socket.join(`session:${sessionId}`);

        await counters.setOnline(examId, sessionId);
        if (session.status !== 'ONLINE') {
          await Session.updateOne({ _id: sessionId }, { status: 'ONLINE', lastHeartbeat: new Date() });
        }
        emitToExam(examId, 'session:status', { sessionId, status: 'ONLINE', focused: true });
        reply({ ok: true });
      } catch (err) {
        console.error('session:join failed:', err.message);
        reply({ ok: false, error: 'SERVER_ERROR' });
      }
    });

    // Candidate: batched integrity signals (flushed every ~2.5 s by the client).
    socket.on('signals:batch', async (payload = {}, ack) => {
      const reply = asAck(ack);
      const { sessionId, examId } = socket.data;
      if (!sessionId || payload.sessionId !== sessionId) return reply({ ok: false, error: 'NOT_JOINED' });
      if (!Array.isArray(payload.signals) || payload.signals.length === 0) return reply({ ok: true, flags: 0 });

      try {
        const signals = payload.signals.slice(0, MAX_SIGNALS_PER_BATCH);
        const { flags } = await processBatch({
          sessionId,
          examId,
          candidate: { id: user.id, name: user.name },
          signals,
        });
        for (const flag of flags) emitToExam(examId, 'flag:new', flag);
        if (flags.length) {
          const rank = { LOW: 1, MED: 2, HIGH: 3 };
          const top = flags.reduce((a, b) => (rank[b.severity] > rank[a.severity] ? b : a));
          emitToExam(examId, 'session:status', { sessionId, status: 'FLAGGED', maxSeverity: top.severity });
        }
        reply({ ok: true, flags: flags.length });
      } catch (err) {
        console.error('signals:batch failed:', err.message);
        reply({ ok: false, error: 'SERVER_ERROR' });
      }
    });

    // Candidate: presence + focus every 10-15 s. Proctors only get a delta when focus changes.
    socket.on('heartbeat', async (payload = {}) => {
      const { sessionId, examId } = socket.data;
      if (!sessionId) return;
      const focused = payload.focused !== false;
      try {
        await counters.heartbeat(examId, sessionId, focused);
        if (focused !== socket.data.focused) {
          socket.data.focused = focused;
          emitToExam(examId, 'session:status', { sessionId, status: 'ONLINE', focused });
        }
      } catch (err) {
        console.error('heartbeat failed:', err.message);
      }
    });

    // Proctor/Admin: subscribe to one exam's live feed.
    socket.on('proctor:join', async (payload = {}, ack) => {
      const reply = asAck(ack);
      try {
        if (!['PROCTOR', 'ADMIN'].includes(user.role)) return reply({ ok: false, error: 'FORBIDDEN' });
        const exam = await Exam.findById(payload.examId).select('proctorIds').lean();
        if (!exam) return reply({ ok: false, error: 'NOT_FOUND' });
        if (user.role === 'PROCTOR' && !exam.proctorIds.some((id) => String(id) === user.id)) {
          return reply({ ok: false, error: 'FORBIDDEN' });
        }
        const examId = String(exam._id);
        socket.join(examRoom(examId));
        watchedExams.add(examId);
        reply({ ok: true, summary: { examId, ...(await counters.getSummary(examId)) } });
      } catch (err) {
        console.error('proctor:join failed:', err.message);
        reply({ ok: false, error: 'SERVER_ERROR' });
      }
    });

    socket.on('proctor:leave', (payload = {}) => {
      if (payload.examId) socket.leave(examRoom(String(payload.examId)));
    });

    socket.on('disconnect', async () => {
      const { sessionId, examId } = socket.data;
      if (!sessionId) return;
      try {
        await counters.setOffline(examId, sessionId);
        const res = await Session.updateOne(
          { _id: sessionId, status: { $ne: 'ENDED' } },
          { status: 'OFFLINE', lastHeartbeat: new Date() }
        );
        if (res.modifiedCount) emitToExam(examId, 'session:status', { sessionId, status: 'OFFLINE' });
      } catch (err) {
        console.error('disconnect handling failed:', err.message);
      }
    });
  });

  // Periodic summary to proctors. io.local: each instance only serves its own connected proctors.
  setInterval(async () => {
    for (const examId of watchedExams) {
      const room = io.sockets.adapter.rooms.get(examRoom(examId));
      if (!room || room.size === 0) {
        watchedExams.delete(examId);
        continue;
      }
      try {
        const summary = await counters.getSummary(examId);
        io.local.to(examRoom(examId)).emit('exam:summary', { examId, ...summary });
      } catch (err) {
        console.error('exam:summary failed:', err.message);
      }
    }
  }, SUMMARY_INTERVAL_MS).unref();

  return io;
}

const getIO = () => io;

module.exports = { initSocket, getIO, emitToExam };
