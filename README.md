# Overlay Proctor: PS 05

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

## Team

| Name | GitHub | Primary responsibility |
|------|--------|------------------------|
| Tanush Bhardwaj | tanush69lucifer | Server core, auth, exams, sessions, realtime, deploy |
| Sohil Malik | Sohil417 | Scoring engine, integrity APIs, load test |
| Sumit Chaudhary | sumit-chaudhary11 | Client detector, demo overlay extension |
| Tanisha Tayal | tanishatayal06 | UI kit, candidate and admin pages |
| Tanya Goyal | Tanyagoyal14 | Proctor live console, drill-down, reports |
