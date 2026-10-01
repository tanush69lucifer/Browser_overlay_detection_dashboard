# Overlay Proctor: PS 05

Online exam integrity dashboard with a browser-side detector, server scoring, and a proctor review console. Detector events are heuristic signals for human review, not proof of misconduct.

## What it detects

- Large fixed/absolute high-z-index page elements, including persistence escalation.
- Built-in and exam-configured fingerprints (including best-effort Cluely DOM signatures), extension iframes, and open Shadow DOM.
- Unexpected DOM growth, window blur, tab visibility, paste occurrence, fullscreen exit, and a DevTools viewport heuristic.
- Optional browser companion active-tab changes where the companion extension is installed.

The browser cannot identify an overlay that exists only in a separate desktop window or browser chrome. It does not capture screen/camera, keystrokes, clipboard contents, or pasted text. See [DETECTION.md](DETECTION.md) for signal details and limits.

## Requirements

- Node.js and npm
- MongoDB (local or Atlas)
- Redis is optional for single-server development

## Run locally (Windows PowerShell)

Use two terminals from the repository root.

### Backend

```powershell
cd server
npm ci
Copy-Item .env.example .env
notepad .env
npm run dev
```

Set `MONGO_URI`, a private `JWT_SECRET`, and `CLIENT_URL` matching the client origin. Keep real credentials in `server/.env` and never commit them. The API and Socket.IO use port 5000 by default. Health check: [http://localhost:5000/health](http://localhost:5000/health).

To enable Google login, create a **Web application** OAuth client in Google Cloud Console and add the local app origin (for example, `http://localhost:5173`) to its Authorized JavaScript origins. Put the same client ID in `GOOGLE_CLIENT_ID` in `server/.env` and `VITE_GOOGLE_CLIENT_ID` in `client/.env`, then restart both servers. The Google button stays disabled until these values are configured. Google sign-up creates candidate accounts; an existing account with a verified matching email is linked to that Google identity. See [Google Identity Services setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

### Client

```powershell
cd client
npm ci
Copy-Item .env.example .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Keep the host consistent (`localhost` vs `127.0.0.1`) with `CLIENT_URL`.

## See detector events in the proctor dashboard


1. Sign in with an account that exists in the configured database. This checkout does not contain a seed script or guarantee demo logins.
2. Ensure the candidate is assigned to an exam and the proctor is assigned to that exam.
3. Open the candidate exam page and start the monitored session.
4. Open that exam in the Proctor Console. New accepted detector signals appear in the live feed with candidate name, signal reason, severity, and a link to that candidate's session. The latest saved detector signals also load after refresh; the session drill-down includes that candidate's signal history and scored flag timeline.
5. Use `http://localhost:5173/detector-test.html` only as a local scanner test bench. Its mock socket events are local and are not sent to MongoDB or the proctor dashboard.

The server scores signals according to exam sensitivity and fingerprint configuration. Signals that do not cross a flag threshold remain visible as detector events; they are not silently discarded from the proctor feed. Flag decisions remain available for human review.

## Optional browser companion

The ordinary exam page can observe focus and visibility but cannot read another tab's URL. The optional Manifest V3 companion in `browser-extension` uses the browser tabs permission to report the active HTTP(S) tab's origin/path and title during an active exam. It strips query strings and fragments and does not read page text, keystrokes, clipboard contents, screen, or browsing history.

For local Chrome/Edge development, enable Developer mode on the browser extensions page, select **Load unpacked**, and choose this repository's `browser-extension` folder. After updating an existing unpacked install, press its **Reload** button once. The companion can connect to an already-open candidate exam tab; confirm the exam page shows **Browser companion connected**, then activate another HTTP(S) tab or navigate that active tab to generate a URL/title event. Copying a URL without switching tabs or navigating does not generate an event. Without the companion, ordinary focus/visibility signals still work, but other-tab URLs and titles are unavailable.
Its scalability

## Project docs and load test

- [Detection behavior and privacy](DETECTION.md)
- [API and data contracts](SPEC.md)
- [Demo extension](demo-overlay/README.md)

### Staged Socket.IO benchmark (50 / 100 / 250 / 500)

This benchmark uses real authenticated candidate sockets, joins each candidate to a unique active session, sends low-risk `WINDOW_BLUR` batches at a configured rate, forces a selected percentage of sockets to reconnect, and records acknowledgement percentiles. An authenticated proctor observer counts signals actually emitted to the exam room. A JSON result and a Markdown proof report are written under `server/loadtest/reports/` after the run; the report includes stage-by-stage pass/fail checks and load-generator resource usage.

1. Start the API in one terminal: `cd server && npm run dev`.
2. Ensure the demo admin and proctor from the seed script already exist. Run `npm run seed` only if they do not, and only against the development database you intend to use. Then run `npm run loadtest:prepare` to create the fixture. For an intentional Atlas dev-cluster run, PowerShell requires `$env:LOADTEST_ALLOW_REMOTE = '1'` in that terminal first.
3. Run `npm run loadtest`. Default stages are 50, 100, 250 and 500 concurrent sessions, 30 seconds per stage, 10 batch attempts/second and 10% forced reconnects. Report thresholds default to >=99% connected, >=99% acknowledged, <=1500ms p95 ACK latency and >=99% reconnect success.

Optional PowerShell configuration before step 3:

```powershell
$env:LOADTEST_URL = 'http://localhost:5000'
$env:LOADTEST_DURATION_SECONDS = '60'
$env:LOADTEST_SIGNAL_RATE = '25'
$env:LOADTEST_RECONNECT_PERCENT = '20'
$env:LOADTEST_SERVER_PID = (Get-NetTCPConnection -LocalPort 5000 -State Listen | Select-Object -First 1 -ExpandProperty OwningProcess)
npm run loadtest
```

Use `LOADTEST_STAGES=50,100` for a quick smoke run, `LOADTEST_RAMP_SECONDS` to change the connection ramp, and `LOADTEST_REPORT_DIR` to choose another report folder. `LOADTEST_SERVER_PID` is optional; without it the report labels server CPU/RSS as not sampled and still records load-generator CPU/RSS plus host free memory. The credentials file contains bearer tokens, is git-ignored, and must not be shared or committed. The prepare step refuses `NODE_ENV=production`; if `MONGO_URI` is a remote `mongodb+srv` cluster, explicitly set `$env:LOADTEST_ALLOW_REMOTE = '1'` only after confirming you intend to create/reset the dedicated test accounts and exam there. Existing account passwords and historical flags are preserved; the benchmark fixture resets dedicated sessions to offline and reuses them without submitting answers.

For the old lightweight checks, set `LOADTEST_MODE=health`, `signals`, or `socket`; the staged benchmark is the default. A report is actual measured evidence only for the target, environment and run recorded inside it—do not generalize one run into a production capacity guarantee.

## Stack

## Team

| Name | GitHub | Primary responsibility |
|------|--------|------------------------|
| Tanush Bhardwaj | tanush69lucifer | Server core, auth, exams, sessions, realtime, deploy |
| Sohil Malik | Sohil417 | Scoring engine, integrity APIs, load test |
| Sumit Chaudhary | sumit-chaudhary11 |Proctor live console, drill-down, report |
| Tanisha Tayal | tanishatayal06 | UI kit, candidate and admin pages |
| Tanya Goyal | Tanyagoyal14 |  Client detector, demo overlay extension | Fully made overlay detector

- Client: React, Vite, Tailwind CSS, React Router, Zustand, Axios, Socket.IO client
- Server: Node.js, Express, MongoDB/Mongoose, Socket.IO, optional Redis
- Authentication and validation: JWT, bcrypt, Zod
