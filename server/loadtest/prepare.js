require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const config = require('../src/config/env');
const User = require('../src/models/User');
const Exam = require('../src/models/Exam');
const Session = require('../src/models/Session');
const { signToken } = require('../src/utils/token');

const CANDIDATE_COUNT = 500;
const LOADTEST_PASSWORD_HASH = User.hashPassword(crypto.randomBytes(24).toString('base64url'));

function assertSafeTarget() {
  if (config.isProd) throw new Error('Refusing to prepare load-test accounts when NODE_ENV=production');
  if (config.mongoUri.startsWith('mongodb+srv://') && process.env.LOADTEST_ALLOW_REMOTE !== '1') {
    throw new Error('MONGO_URI points to a remote cluster. Set LOADTEST_ALLOW_REMOTE=1 only when you intentionally want test data in that database.');
  }
}

async function loadSeededStaff() {
  const [admin, proctor] = await Promise.all([
    User.findOne({ email: 'admin@demo.com', role: 'ADMIN', isActive: true }).select('_id name role'),
    User.findOne({ email: 'proctor@demo.com', role: 'PROCTOR', isActive: true }).select('_id name role'),
  ]);
  if (!admin || !proctor) throw new Error('Run "npm run seed" first so the demo admin and proctor exist.');
  return { admin, proctor };
}

async function upsertCandidates() {
  const passwordHash = await LOADTEST_PASSWORD_HASH;
  const emails = Array.from({ length: CANDIDATE_COUNT }, (_, index) => `loadtest${index + 1}@demo.com`);
  await User.bulkWrite(emails.map((email, index) => ({
    updateOne: {
      filter: { email },
      update: {
        $setOnInsert: {
          email,
          name: `Load Test Candidate ${String(index + 1).padStart(3, '0')}`,
          role: 'CANDIDATE',
          isActive: true,
          passwordHash,
        },
      },
      upsert: true,
    },
  })), { ordered: false });
  const users = await User.find({ email: { $in: emails } }).select('_id name email role isActive').sort({ email: 1 }).lean();
  const unusable = users.filter((user) => user.role !== 'CANDIDATE' || !user.isActive);
  if (unusable.length) throw new Error(`${unusable.length} load-test accounts are inactive or not candidates; review them before running the benchmark.`);
  return users;
}

async function upsertBenchmarkExam(admin, proctor, candidates) {
  const now = new Date();
  const exam = await Exam.findOneAndUpdate(
    { title: 'Load Test Exam', createdBy: admin._id },
    {
      $set: {
        description: 'Disposable 500-candidate Socket.IO benchmark fixture.',
        startAt: new Date(now.getTime() - 5 * 60 * 1000),
        endAt: new Date(now.getTime() + 5 * 60 * 60 * 1000),
        durationMin: 300,
        sensitivity: 'LOW',
        candidateIds: candidates.map((candidate) => candidate._id),
        proctorIds: [proctor._id],
        fingerprintIds: [],
        questions: [{ text: 'Load test fixture question. No response is required.', options: [] }],
      },
    },
    { upsert: true, new: true, runValidators: true }
  );
  return exam;
}

async function upsertSessions(exam, candidates) {
  const now = new Date();
  await Session.bulkWrite(candidates.map((candidate) => ({
    updateOne: {
      filter: { examId: exam._id, candidateId: candidate._id },
      update: {
        $set: {
          status: 'OFFLINE',
          startedAt: now,
          endedAt: null,
          lastHeartbeat: now,
        },
        $setOnInsert: { examId: exam._id, candidateId: candidate._id },
      },
      upsert: true,
    },
  })), { ordered: false });
  return Session.find({ examId: exam._id, candidateId: { $in: candidates.map((candidate) => candidate._id) } })
    .select('_id candidateId').lean();
}

async function main() {
  assertSafeTarget();
  await mongoose.connect(config.mongoUri, { maxPoolSize: 30 });
  const { admin, proctor } = await loadSeededStaff();
  const candidates = await upsertCandidates();
  if (candidates.length !== CANDIDATE_COUNT) throw new Error(`Expected ${CANDIDATE_COUNT} test candidates, found ${candidates.length}`);
  const exam = await upsertBenchmarkExam(admin, proctor, candidates);
  const sessions = await upsertSessions(exam, candidates);
  const sessionByCandidate = new Map(sessions.map((session) => [String(session.candidateId), String(session._id)]));
  const credentials = {
    generatedAt: new Date().toISOString(),
    expiresIn: config.jwtExpiresIn,
    examId: String(exam._id),
    proctorToken: signToken(proctor),
    candidates: candidates.map((candidate) => ({
      token: signToken(candidate),
      sessionId: sessionByCandidate.get(String(candidate._id)),
    })),
  };
  const outputPath = process.env.LOADTEST_CREDENTIALS_FILE
    ? path.resolve(process.env.LOADTEST_CREDENTIALS_FILE)
    : path.join(__dirname, 'credentials.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(credentials, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  console.log(`Prepared ${credentials.candidates.length} candidate sessions for exam ${exam._id}.`);
  console.log(`Credential file (contains bearer tokens; keep private): ${outputPath}`);
  console.log('The benchmark reuses these sessions and does not create new sessions or write answers.');
}

main()
  .catch((error) => {
    console.error('Load-test preparation failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
