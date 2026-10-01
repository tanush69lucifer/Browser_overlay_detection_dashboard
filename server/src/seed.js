require('dotenv').config();

const mongoose = require('mongoose');
const User = require('./models/User');
const Exam = require('./models/Exam');
const Fingerprint = require('./models/Fingerprint');
const Threshold = require('./models/Threshold');
const config = require('./config/env');

const users = [
  ['Admin', 'admin@demo.com', 'Admin@123', 'ADMIN'],
  ['Proctor', 'proctor@demo.com', 'Proctor@123', 'PROCTOR'],
  ['Candidate', 'candidate@demo.com', 'Candidate@123', 'CANDIDATE'],
];

const fingerprints = [
  {
    name: 'Grammarly',
    tool: 'GRAMMARLY',
    matcherType: 'SELECTOR',
    matcher: 'grammarly-desktop-integration, grammarly-extension, [data-grammarly-shadow-root], body[data-gr-ext-installed]',
    weight: 1,
    severity: 'LOW',
    allowed: true,
  },
  {
    name: 'Sider AI',
    tool: 'SIDER',
    matcherType: 'SELECTOR',
    matcher: '[id^="sider"], [class*="sider-"], sider-ui',
    weight: 10,
    severity: 'HIGH',
  },
  {
    name: 'Monica AI',
    tool: 'MONICA',
    matcherType: 'SELECTOR',
    matcher: '[id*="monica"], [class*="monica"], monica-assistant',
    weight: 10,
    severity: 'HIGH',
  },
];

async function seed() {
  await mongoose.connect(config.mongoUri);
  for (const [name, email, password, role] of users) {
    await User.updateOne(
      { email },
      { $set: { name, role, isActive: true, passwordHash: await User.hashPassword(password) } },
      { upsert: true }
    );
  }

  const thresholds = { LOW: 15, MEDIUM: 8, HIGH: 4 };
  for (const [sensitivity, flagScore] of Object.entries(thresholds)) {
    await Threshold.updateOne(
      { sensitivity },
      { $setOnInsert: { sensitivity, windowMs: 60000, flagScore } },
      { upsert: true }
    );
  }

  for (const fingerprint of fingerprints) {
    await Fingerprint.updateOne(
      { tool: fingerprint.tool },
      { $setOnInsert: fingerprint },
      { upsert: true }
    );
  }

  await Fingerprint.updateOne(
    { tool: 'demo-overlay' },
    {
      $set: { matcher: '#proctor-demo-overlay' },
      $setOnInsert: {
        name: 'Demo overlay extension',
        tool: 'demo-overlay',
        matcherType: 'SELECTOR',
        weight: 10,
        severity: 'HIGH',
      },
    },
    { upsert: true }
  );

  const [admin, proctor, candidate] = await Promise.all([
    User.findOne({ email: 'admin@demo.com' }).select('_id'),
    User.findOne({ email: 'proctor@demo.com' }).select('_id'),
    User.findOne({ email: 'candidate@demo.com' }).select('_id'),
  ]);
  const activeFingerprints = await Fingerprint.find({
    tool: { $in: fingerprints.map(({ tool }) => tool).concat('demo-overlay') },
    isActive: true,
  }).select('_id');
  const now = Date.now();
  await Exam.findOneAndUpdate(
    { title: 'Demo Monitoring Exam', createdBy: admin._id },
    {
      $set: {
        description: 'Seeded exam for verifying candidate monitoring and proctor review.',
        startAt: new Date(now - 60_000),
        endAt: new Date(now + 24 * 60 * 60 * 1000),
        durationMin: 60,
        sensitivity: 'MEDIUM',
        candidateIds: [candidate._id],
        proctorIds: [proctor._id],
        fingerprintIds: activeFingerprints.map(({ _id }) => _id),
        questions: [
          {
            text: 'Which browser event indicates that an exam tab is no longer visible?',
            options: ['visibilitychange', 'DOMContentLoaded', 'hashchange', 'storage'],
          },
          {
            text: 'What does a candidate-side overlay detector send to the backend?',
            options: ['Integrity metadata signals', 'Full screen recordings', 'Keystroke logs', 'Browser passwords'],
          },
        ],
      },
    },
    { upsert: true, new: true, runValidators: true }
  );
  console.log('Seed complete');
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
