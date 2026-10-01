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

For local Chrome/Edge development, enable Developer mode on the browser extensions page, select **Load unpacked**, and choose this repository's `browser-extension` folder. Reload the candidate app and start an exam. Without the companion, ordinary focus/visibility signals still work, but other-tab URLs and titles are unavailable.

## Project docs and load test

- [Detection behavior and privacy](DETECTION.md)
- [API and data contracts](SPEC.md)
- [Demo extension](demo-overlay/README.md)

Run `cd server && npm run loadtest` with the API running for the health endpoint check. Socket mode requires the documented disposable candidate tokens and sessions. Do not treat the target concurrency as measured until a real run completes.

## Stack

- Client: React, Vite, Tailwind CSS, React Router, Zustand, Axios, Socket.IO client
- Server: Node.js, Express, MongoDB/Mongoose, Socket.IO, optional Redis
- Authentication and validation: JWT, bcrypt, Zod
