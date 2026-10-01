# Overlay Proctor: PS 05 | Team <Team Name>

Live exam-integrity dashboard that detects configured browser overlay indicators during a monitored test and sends flags to proctors for review. The project targets 500 concurrent candidates, but that scale claim is not a measured benchmark until the Socket.IO load test below has been run in the target environment.

## Team
| Name | GitHub | Primary responsibility |
|------|--------|------------------------|
| Tanush Bhardwaj | tanush69lucifer | Server core, auth, exams, sessions, realtime, deploy |
| Sohil Malik | Sohil417 | Scoring engine, integrity APIs, load test |
| Sumit Chaudhary | sumit-chaudhary11 | Client detector, demo overlay extension |
| Tanisha Tayal | tanishatayal06 | UI kit, candidate and admin pages |
| Tanya Goyal | Tanyagoyal14 | Proctor live console, drill-down, reports |

## Live Links
- Frontend: TODO
- Backend: TODO
- Demo video: TODO

## Tech Stack
- Frontend: React 18, Vite, Tailwind CSS, Zustand, Axios, Socket.IO client
- Backend: Node.js, Express, MongoDB/Mongoose, Socket.IO, Redis-compatible counters

## Features
- Candidate exam sessions with answers and live integrity detection
- Proctor console with session status, flags, and reports
- Admin exam assignment, fingerprint management, and scoring thresholds
- Admin report summaries/exports without candidate drill-down or flag review controls
- Configurable scoring thresholds and real-time Socket.IO events
- CSV reports and browser Print / Save as PDF

## Architecture
The `client` Vite app communicates with the `server` REST API under `/api/v1`.
Candidate detector events are sent over Socket.IO and scored by the server.
MongoDB stores users, exams, sessions, flags, fingerprints, and thresholds.
Redis is optional for single-instance local development and recommended for scaling.

## Detection: what we can and cannot detect
See [DETECTION.md](DETECTION.md).

## Optional browser companion
The ordinary exam page can observe focus and visibility changes but cannot read another
tab's URL. The optional Manifest V3 companion in `browser-extension` uses the browser's
`tabs` permission to report the active tab's HTTP(S) origin/path and title, plus whether
the candidate returned to the exam tab. It removes URL query strings and fragments and
does not read page text, keystrokes, clipboard contents, screen, or browser history.
It runs only after the candidate starts a monitored session and stops when that session
ends or its exam tab closes.

For local development in Chrome or Edge:
1. Open the browser's extensions page and enable Developer mode.
2. Choose **Load unpacked** and select this repository's `browser-extension` folder.
3. Reload `http://localhost:5175` and begin an exam; the candidate status should show
   **Browser companion connected**.
4. Switch to another HTTP(S) tab; the assigned Proctor's live feed should show
   **Browser Tab Switch** with the destination title and sanitized URL.

For deployment, add only the deployed candidate app origin to
`browser-extension/manifest.json` under `content_scripts.matches`, then reload/repackage
the extension. The candidate must install/enable it and accept the browser's requested
permissions. Without it, the existing focus/visibility signals still work, but other-tab
URLs and titles are unavailable.

## Scale: load testing
Run `cd server && npm run loadtest` while the API is running. The default `health` mode checks
HTTP health endpoint throughput only; it does not simulate candidate sessions. For a real
Socket.IO session/signal run, set `LOADTEST_MODE=socket`, `LOADTEST_CLIENTS`, and comma-separated
`LOADTEST_TOKENS` and `LOADTEST_SESSION_IDS` for that many unique candidate JWTs and active
sessions within their exam windows. It connects all clients concurrently, joins each session,
sends one low-severity test signal per candidate, and prints connection and acknowledgement
latency percentiles. Use disposable test sessions: existing session score history can affect
whether a signal creates a flag. `LOADTEST_MODE=signals` uses the authenticated HTTP fallback;
`LOADTEST_FLAG_BURST=1` intentionally creates flags and must only target a disposable exam.
Record the command, candidate count, environment, and actual output when claiming a scale result.
No 500-session Socket.IO benchmark is claimed by this repository until that run has completed.

## Local Setup
1. `git clone https://github.com/tanush69lucifer/Browser_overlay_detection_dashboard.git && cd Browser_overlay_detection_dashboard`
2. `cd server && npm install && cp .env.example .env` (fill values)
3. `npm run seed && npm run dev`
4. `cd ../client && npm install && cp .env.example .env && npm run dev`

## Test Credentials
| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.com | Admin@123 |
| Proctor | proctor@demo.com | Proctor@123 |
| Candidate | candidate@demo.com | Candidate@123 |

## API Documentation
See the endpoint table in [SPEC.md](SPEC.md#5-rest-endpoints).

## Known Limitations
- MongoDB is required to run the API and seed demo data.
- Redis is recommended for multi-instance deployments; local fallback is in-memory.
- Browser overlay detection is heuristic and cannot inspect browser-protected content.
- False-positive percentages require reviewed/cleared flags and a defined measurement period; the report's cleared-verdict share is not a validated false-positive rate.
- Session replay is intentionally not implemented; the app stores integrity metadata, not screen recordings or keystrokes.
- Replace the Live Links placeholders, attach an actual demo video, and add the required 10–20 authentic prompt-history entries and any team/contribution evidence before submission. The current `PROMPTS.md` has five contributor summaries, not a complete prompt history; do not present invented prompts as historical evidence.
- Do not treat placeholder links or unrun load tests as completed evidence.
