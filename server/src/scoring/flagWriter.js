// Buffered bulk flag writer.
// Collects flags in an in-memory buffer and flushes to MongoDB every 2 seconds
// using Flag.insertMany and bulk Session updates to reduce database write load.

const Flag = require('../models/Flag');
const Session = require('../models/Session');
const { SEVERITY_RANK } = require('./weights');

const FLUSH_INTERVAL_MS = 2000;
let buffer = [];
let isFlushing = false;

/**
 * Enqueues a flag document into the in-memory write buffer.
 *
 * @param {Object} flagDoc - Flag document to be inserted
 */
function enqueue(flagDoc) {
  if (!flagDoc) return;
  buffer.push(flagDoc);
}

/**
 * Flushes all buffered flags to MongoDB in bulk.
 */
async function flush() {
  if (isFlushing || buffer.length === 0) return;

  isFlushing = true;
  const toWrite = buffer;
  buffer = [];

  try {
    // 1. Bulk insert all buffered flags
    await Flag.insertMany(toWrite, { ordered: false });
  } catch (err) {
    console.error('flagWriter insertMany error:', err.message);
  }

  try {
    // 2. Aggregate updates per session
    const sessionUpdates = new Map();
    for (const flag of toWrite) {
      const sid = String(flag.sessionId);
      const curr = sessionUpdates.get(sid) || { count: 0, highestSeverity: 'NONE' };
      curr.count += 1;
      const currRank = SEVERITY_RANK[curr.highestSeverity] || 0;
      const flagRank = SEVERITY_RANK[flag.severity] || 0;
      if (flagRank > currRank) {
        curr.highestSeverity = flag.severity;
      }
      sessionUpdates.set(sid, curr);
    }

    // 3. Perform bulk updates on Session collection
    const ops = [];
    for (const [sid, data] of sessionUpdates.entries()) {
      // Increment flagCount
      ops.push({
        updateOne: {
          filter: { _id: sid },
          update: { $inc: { flagCount: data.count } },
        },
      });

      // Conditionally raise maxSeverity
      if (data.highestSeverity === 'HIGH') {
        ops.push({
          updateOne: {
            filter: { _id: sid },
            update: { $set: { maxSeverity: 'HIGH' } },
          },
        });
      } else if (data.highestSeverity === 'MED') {
        ops.push({
          updateOne: {
            filter: { _id: sid, maxSeverity: { $in: ['NONE', 'LOW'] } },
            update: { $set: { maxSeverity: 'MED' } },
          },
        });
      } else if (data.highestSeverity === 'LOW') {
        ops.push({
          updateOne: {
            filter: { _id: sid, maxSeverity: 'NONE' },
            update: { $set: { maxSeverity: 'LOW' } },
          },
        });
      }
    }

    if (ops.length > 0) {
      await Session.bulkWrite(ops, { ordered: false });
    }
  } catch (err) {
    console.error('flagWriter session bulkWrite error:', err.message);
  } finally {
    isFlushing = false;
  }
}

// Background flush timer every 2 seconds
const flushInterval = setInterval(() => {
  flush().catch((err) => {
    console.error('Unhandled flagWriter flush error:', err.message);
  });
}, FLUSH_INTERVAL_MS);

// Allow process to exit cleanly without waiting for this timer
flushInterval.unref();

module.exports = {
  enqueue,
  flush,
  getBufferSize: () => buffer.length,
};
