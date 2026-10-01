# Prompts: Sohil

| # | Prompt (short) | What it produced |
|---|---|---|
| 1 | Create Mongoose models Flag, Fingerprint, Threshold per SPEC section 4 | `models/Flag.js`, `models/Fingerprint.js`, `models/Threshold.js` schemas |
| 2 | Add signal weights, default thresholds and severities per SPEC section 7 | `scoring/weights.js` with weights, severities and thresholds |
| 3 | Add cached fingerprint and threshold config loader with 30s TTL | `scoring/configCache.js` for fingerprints, thresholds and exam sensitivity |
| 4 | Add sliding signal window using Redis sorted set with in-memory fallback | `redis/signalWindow.js` with add() and clear() |
| 5 | Add debounce for persistent overlay signals with Redis SET NX EX | `scoring/debounce.js` with 60s/10s TTL |
| 6 | Add buffered bulk flag writer flushing to Mongo every 2s | `scoring/flagWriter.js` with Flag.insertMany and Session bulkWrite |
| 7 | Implement processBatch scoring into LOW/MED/HIGH flags per SPEC rules 1-7 | `scoring/score.js` with full signal processing pipeline |
| 8 | Add session flag timeline and review endpoints with proctor/admin auth | `controllers/flags.controller.js` and flag routes |
| 9 | Add admin fingerprint and threshold management with validation and cache invalidation | `controllers/fingerprints.controller.js` and admin routes |
| 10 | Add HTTP fallback batch ingest with session ownership check | `controllers/flags.controller.js` postSignals and route |
| 11 | Add integrity report per candidate with CSV download export | `controllers/report.controller.js` and report route |
| 12 | Implement socket.io concurrent client load tester with latency percentiles | `server/loadtest/spawnClients.js` |
| 13 | Document load test methodology, metrics, architecture and bottlenecks | `LOADTEST.md` |
