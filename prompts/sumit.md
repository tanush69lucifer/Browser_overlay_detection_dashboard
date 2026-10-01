# Prompts: Sumit

| # | Prompt (short) | What it produced |
|---|---|---|
| 1 | Create client overlay detector and telemetry batcher | `client/src/detector/index.js`, `fingerprints.js`, `scanners.js`, `listeners.js`, and `batcher.js` implementing all 9 signals, 2.5s batching, immediate HIGH flush, HTTP fallback, and 12s heartbeat |
| 2 | Create detector standalone testbench | `client/detector-test.html` interactive test runner with real-time signal stream and attack simulation buttons |
| 3 | Create demo overlay Chrome extension with Alt+O toggle | `demo-overlay/` (Manifest V3, `content.js`, `overlay.css`, `background.js`, `README.md`) simulating unauthorized AI assistant for live proctor demo |
| 4 | Write comprehensive detection documentation and limits | `DETECTION.md` covering all 9 detection techniques, `[data-proctor]` boundary rules, scoring heuristics, privacy compliance, and hardware limits |
