# Overlay Proctor: PS 05

<<<<<<< HEAD
Overlay Proctor is an exam-integrity dashboard for online assessments. Its client-side detector looks for browser-visible signals associated with injected overlays and extensions, then sends compact signals to the backend for scoring and human review. A signal is an indicator for review, not proof of misconduct.

The detector does not record keystrokes, keep pasted text, or capture the screen or camera. A paste signal contains only the character count.

## Features

- Candidate, proctor, and admin experiences with role-based access.
- Exam creation, candidate sessions, answer submission, and live proctor updates.
- Browser-side detection for high-z overlays, known/configurable fingerprints, extension iframes, open Shadow DOM, DOM growth, focus/visibility changes, large paste length, and a DevTools heuristic.
- Signal batching over Socket.IO with an HTTP fallback, plus a 12-second session heartbeat.
- Configurable fingerprints and sensitivity thresholds.
- Redis-backed realtime counters when configured; single-instance in-memory fallback otherwise.

## Requirements

- Node.js and npm.
- A MongoDB database (local or Atlas).
- Redis is optional for local single-server development.

## Run locally (Windows PowerShell)

Open two PowerShell terminals from the repository root.

### 1. Configure and start the backend

```powershell
cd server
npm ci
Copy-Item .env.example .env
notepad .env
npm run dev
```

Set at least `MONGO_URI` to your MongoDB connection string and `JWT_SECRET` to a private random secret. Keep the real values in `server/.env`; `.env` files are ignored by Git. Leave `REDIS_URL` empty for single-instance development.

The API and Socket.IO server listens on `http://localhost:5000`. Check it at [http://localhost:5000/health](http://localhost:5000/health); a running server returns `{"success":true,"data":{"status":"ok"}}`.

### 2. Configure and start the client

In the second terminal, from the repository root:

```powershell
cd client
npm ci
Copy-Item .env.example .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Keep the browser origin consistent with `CLIENT_URL` in `server/.env`; if you use `127.0.0.1` instead of `localhost`, add that origin to `CLIENT_URL` too.

## Run the detector test bench

Open [http://localhost:5173/detector-test.html](http://localhost:5173/detector-test.html). Its controls create local test DOM elements and show detected signals in the table:

1. Inject a fixed high-z overlay.
2. Add an extension iframe.
3. Attach an open Shadow DOM root.
4. Add a direct child to `<html>`.
5. Add a Sider/Monica fingerprint.
6. Simulate a large paste, blur, or DevTools viewport gap.

The test bench uses a mock socket, so its signals are displayed locally and are not saved to MongoDB or sent to the proctor dashboard. For end-to-end monitoring, sign in to the app, start an exam session, and inspect the proctor dashboard.

## Accounts and demo data

This checkout does not include `server/src/seed.js`, so there is no seed command or guaranteed set of demo credentials. Login requires accounts already present in the configured MongoDB database. Public registration creates candidate accounts; admin/proctor accounts must be provisioned through an authorized admin workflow.

## Cluely and browser visibility limits

The detector includes a best-effort Cluely fingerprint for matching page DOM identifiers/classes containing `cluely`. It can also report focus and visibility changes. It cannot identify Cluely by brand when Cluely draws as a separate desktop/native window or browser-chrome overlay outside the exam page DOM. Browser heuristics can miss overlays and can produce false positives; proctors should review signals in context. See [DETECTION.md](DETECTION.md) for signal details and limitations.

## Project docs

- [Detection behavior and privacy](DETECTION.md)
- [API, data model, signals, and realtime contracts](SPEC.md)
- Demo extension instructions: [demo-overlay/README.md](demo-overlay/README.md)

## Tech stack

- **Client:** React 18, Vite, Tailwind CSS 4, React Router, Zustand, Axios, Socket.IO client, and Recharts.
- **Server:** Node.js, Express, MongoDB with Mongoose, Socket.IO, and optional Redis.
- **Authentication and validation:** JWT, bcrypt, and Zod.
=======
Live exam-integrity dashboard that detects configured browser overlay indicators during a monitored test and sends flags to proctors for review. The project targets 500 concurrent candidates, but that scale claim is not a measured benchmark until the Socket.IO load test below has been run in the target environment.
>>>>>>> origin/main

## Team

| Name | GitHub | Primary responsibility |
|------|--------|------------------------|
| Tanush Bhardwaj | tanush69lucifer | Server core, auth, exams, sessions, realtime, deploy |
| Sohil Malik | Sohil417 | Scoring engine, integrity APIs, load test |
| Sumit Chaudhary | sumit-chaudhary11 | Client detector, demo overlay extension |
| Tanisha Tayal | tanishatayal06 | UI kit, candidate and admin pages |
| Tanya Goyal | Tanyagoyal14 | Proctor live console, drill-down, reports |
<<<<<<< HEAD
=======

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
- Admin proctor-account creation, exam assignment, fingerprint management, and scoring thresholds
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
>>>>>>> origin/main
