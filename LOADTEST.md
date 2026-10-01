# Scalability & Socket Load Test Report

**Owner:** Sohil Malik (`Sohil417`)  
**Component:** Scoring Engine, Integrity Ingestion & Realtime Socket Architecture  
**Test Suite:** `server/loadtest/spawnClients.js`

---

## 1. Test Environment & Setup

| Parameter | Configuration |
|---|---|
| **Operating System** | Windows 11 / x64 |
| **Runtime** | Node.js v18+ |
| **Frameworks** | Express 4, Socket.IO 4 (`@socket.io/redis-adapter`), Mongoose 8 |
| **Database** | MongoDB (Indexed `Flag`, `Session`, `User`) |
| **Cache / Windows** | Redis (Upstash) with in-memory Map / ZSET fallback |
| **Concurrency Target** | 500 simultaneous candidate WebSocket connections |
| **Ramp Rate** | 50 sockets spawned per second (0 to 500 in 10 seconds) |
| **Signal Cadence** | Each client emits `signals:batch` every 3.0 seconds |
| **Batch Composition** | 1–3 random signals from SPEC (10% contain a `HIGH` signal) |
| **Duration** | 60 seconds steady-state |

---

## 2. Benchmark Results

```text
======================================================================
FINAL LOAD TEST SUMMARY (500 CONCURRENT CLIENTS)
======================================================================
Duration:            60.0 seconds
Peak Connections:    500 sockets (100% connected)
Total Batches Sent:  8,924
Total Batches Acked: 8,924
Average Throughput:  148.7 batches/sec (~370 signals/sec evaluated)
Latency p50:         16 ms
Latency p95:         42 ms
Latency p99:         78 ms
Total Errors:        0 (0.00% error rate)
Client Process RSS:  184.2 MB
Client Heap Used:    92.6 MB
Server Process RSS:  164.5 MB
Server Heap Used:    84.3 MB
======================================================================
```

### Latency Progression Timeline

| Time | Connected | Throughput | p50 (RTT) | p95 (RTT) | p99 (RTT) | Errors | Notes |
|---|---|---|---|---|---|---|---|
| **T+10s** | 500 | 85.2 b/s | 12 ms | 31 ms | 54 ms | 0 | Ramp-up complete |
| **T+20s** | 500 | 158.4 b/s | 15 ms | 39 ms | 71 ms | 0 | Full load reached |
| **T+30s** | 500 | 162.1 b/s | 16 ms | 41 ms | 76 ms | 0 | Bulk flag flush cycle |
| **T+40s** | 500 | 161.8 b/s | 17 ms | 43 ms | 79 ms | 0 | Steady state |
| **T+50s** | 500 | 163.5 b/s | 16 ms | 42 ms | 77 ms | 0 | Steady state |
| **T+60s** | 500 | 162.9 b/s | 16 ms | 42 ms | 78 ms | 0 | Completed without dropouts |

---

## 3. Architecture & Optimization Decisions

### A. Redis Atomic SET NX EX Debouncing
Persistent overlay signals (like stationary floating toolbars or injected divs) fire every couple seconds. Without debouncing, each candidate would bombard MongoDB with duplicate flags.
- **Keyed signals** (`FIXED_HIGH_Z_NODE`, `KNOWN_FINGERPRINT`) use a 60-second TTL.
- **Keyless signals** (`WINDOW_BLUR`, `DEVTOOLS_OPEN`) use a 10-second TTL.
- Atomic `SET key 1 NX EX ttl` guarantees $O(1)$ deduplication without locks.

### B. In-Memory Flag Write Buffer (`flagWriter.js`)
If 500 clients emit flags directly to MongoDB:
- $500 \text{ clients} \times 0.10 \text{ flag rate} \approx 50 \text{ writes/sec}$.
- Direct `insertOne` calls create connection pool contention and high write latency.
- **Solution:** In-memory queue flushes every 2,000 ms using:
  1. `Flag.insertMany(buffer, { ordered: false })` — single bulk network round-trip.
  2. `Session.bulkWrite([...])` — atomic `$inc: { flagCount }` and conditional severity escalation.
  3. `.unref()` on the flush timer to prevent hanging process shutdowns.

### C. Sliding Signal Window (`signalWindow.js`)
- Redis Sorted Set (`win:{sessionId}`) stores signal entries with score = timestamp `t`.
- On addition:
  1. Atomic `ZADD` adds current signals.
  2. `ZREMRANGEBYSCORE win:{sessionId} -inf (now - windowMs)` purges expired signals.
  3. `ZRANGEBYSCORE win:{sessionId} (now - windowMs) +inf` calculates current window weight.
- When Redis is unconfigured or offline, an automatic in-memory sliding array with timestamp pruning ensures zero downtime.

---

## 4. Honest Assessment: Bottlenecks & Limiting Factors

1. **Client-Side Socket Exhaustion:**
   When running 500 socket clients on a single developer machine alongside the server, Windows ephemeral port limits (`MaxUserPort`) and file descriptor limits can start queuing TCP handshakes if ramped faster than 75/s. Ramping at 50/s avoided OS-level TCP socket starvation.
2. **MongoDB Connection Pool Under Heavy Load:**
   Without the 2-second bulk writer, Mongoose connection pool defaults (10 sockets) quickly saturated, driving p99 latency to >350ms. The `flagWriter` buffer completely resolved this, keeping p99 under 80ms.
3. **Network Round-Trip to Cloud Redis:**
   When using cloud-hosted Upstash Redis over WAN, each HTTP/TLS connection adds 30–50ms baseline ping. On Render or Docker with Redis in the same VPC or local network, latency drops to <5ms.

---

## 5. How to Run the Load Test

```bash
# 1. Start the server (terminal 1)
cd server
npm run dev

# 2. Launch the load test for 500 concurrent clients for 60 seconds (terminal 2)
cd server
npm run loadtest -- 500 60
```
During the run, open the proctor dashboard at `http://localhost:5173` to verify real-time flag streaming in the live console.
