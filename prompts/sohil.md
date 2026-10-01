# Prompts: Sohil

| # | Prompt (short) | What it produced |
|---|---|---|
| 1 | Create Mongoose models Flag, Fingerprint, Threshold per SPEC section 4 | `models/Flag.js`, `models/Fingerprint.js`, `models/Threshold.js` schemas |
| 2 | Add signal weights, default thresholds and severities per SPEC section 7 | `scoring/weights.js` with weights, severities and thresholds |
| 3 | Add cached fingerprint and threshold config loader with 30s TTL | `scoring/configCache.js` for fingerprints, thresholds and exam sensitivity |
| 4 | Add sliding signal window using Redis sorted set with in-memory fallback | `redis/signalWindow.js` with add() and clear() |
| 5 | Add debounce for persistent overlay signals with Redis SET NX EX | `scoring/debounce.js` with 60s/10s TTL |
