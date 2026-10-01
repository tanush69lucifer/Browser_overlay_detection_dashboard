# SPEC: Browser Overlay Detection Dashboard (PS05)

Single source of truth for the team. Paste this file into every AI session.
Changing a contract (field, event, endpoint, signal code)? Tell the team first.

## 1. Stack

- **Server:** Node 18+, Express 4, Mongoose 8, Socket.IO 4 + `@socket.io/redis-adapter`, ioredis (Upstash), zod, bcryptjs, jsonwebtoken, helmet, cors, express-rate-limit, express-mongo-sanitize. CommonJS (`require`).
- **Client:** React 18 + Vite, Tailwind v4, react-router-dom 6, axios, socket.io-client, zustand, react-hot-toast, react-virtuoso, recharts. Plain JavaScript/JSX, no TypeScript.
- **MongoDB:** users, exams, sessions, flags, fingerprints, thresholds.
- **Redis:** live counters, sliding signal windows, debounce keys, Socket.IO adapter. Raw signals are not stored as a continuous stream; signals contributing to a flag are retained in flag evidence.
- `redis` (server/src/config/redis.js) is `null` when `REDIS_URL` is empty. Every Redis consumer needs an in-memory fallback.

## 2. Team and ownership

| Member | GitHub | Owns | Branch |
|---|---|---|---|
| Tanush (lead) | tanush69lucifer | Server core, auth, users, exams, sessions, realtime (`io.js`), counters, seed, deploy, README | `feature/server-core` |
| Sohil | Sohil417 | Scoring engine, Flag/Fingerprint/Threshold models, flags + fingerprints + thresholds + report APIs, HTTP signal fallback, load test | `feature/scoring` |
| Sumit | sumit-chaudhary11 | Client detector + batcher + heartbeat, demo overlay extension, DETECTION.md | `feature/detector` |
| Tanisha | tanishatayal06 | UI kit, app shell, login, candidate pages (exam page hosts the detector), admin pages | `feature/ui` |
| Tanya | Tanyagoyal14 | Proctor home, live console (grid + flag feed), drill-down, report page, demo video | `feature/dashboard` |

**Rule:** edit only files you own. Shared files (`app.js`, `App.jsx`, `index.css`, `package.json`, `io.js`) are changed by Tanush only. Need a new npm package? Ask Tanush.

```
server/src/
  config/ middlewares/ utils/ app.js index.js            Tanush
  models/User.js Exam.js Session.js                      Tanush
  models/Flag.js Fingerprint.js Threshold.js             Sohil
  realtime/io.js  redis/counters.js                      Tanush
  redis/signalWindow.js                                  Sohil
  scoring/*                                              Sohil
  routes/core.routes.js + controllers/{auth,users,exams,sessions}.controller.js
    + validators/core.validators.js + seed.js            Tanush
  routes/integrity.routes.js + controllers/{flags,fingerprints,report}.controller.js
    + validators/integrity.validators.js                 Sohil
server/loadtest/  LOADTEST.md                            Sohil
client/src/
  main.jsx App.jsx index.css api/client.js store/auth.js
    realtime/socket.js components/ProtectedRoute.jsx     Tanush
  components/ui/* components/layout/* pages/Login.jsx
    pages/candidate/* pages/admin/* api/exams.js api/admin.js   Tanisha
  detector/*  client/detector-test.html                  Sumit
  pages/proctor/* components/proctor/* store/live.js api/proctor.js   Tanya
demo-overlay/  DETECTION.md                              Sumit
prompts/<yourname>.md                                    each member
```

## 3. Conventions

**API**
- Base `/api/v1`. Header `Authorization: Bearer <token>`.
- Success: `{ success: true, data, message? }`
- Error: `{ success: false, error: { code, message, details? } }`
- Codes: `VALIDATION_ERROR` 400, `INVALID_ID` 400, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `RATE_LIMITED` 429, `SERVER_ERROR` 500.
- Lists: `?page=1&limit=20&sort=-createdAt&search=` returns `{ items, page, limit, total, totalPages }` (use `paginate()` from `utils/response.js`).
- Always use `_id` (Mongo default) for ids in JSON.

**Server code**
- Controllers are wrapped with `asyncHandler`. Throw `new ApiError(status, code, message)`.
- Validate every body with zod: `router.post('/x', requireAuth, requireRole('ADMIN'), validate(schema), ctrl)`.
- Respond with `ok(res, data, { status, message })`.
- Authorisation is checked on the server for every protected endpoint (not only hidden buttons).
- Push to proctors from REST code: `const { emitToExam } = require('../realtime/io')`.

**Client code**
- `import api from '../api/client'`. It resolves with `data` directly and rejects with `{ code, message, details }`. Show errors with `toast.error(err.message)`.
- Every data screen has: loading (skeleton/spinner), empty state, error state, success feedback.
- Theme classes: `bg-base`, `bg-surface`, `text-text`, `text-ok`, `text-warn`, `text-danger`, `text-info`, `bg-primary`. Numbers use class `num` (tabular figures).
- `#root` has `data-proctor="1"`. Any modal/portal rendered outside `#root` must also carry `data-proctor="1"`, or the detector flags our own UI.
- Responsive down to 360px, no horizontal scroll.
- Status is never colour alone: always colour + icon/label.
- Language: "flag for review", never "cheater".

**Git**
- Commit format `type(scope): message` with types feat, fix, refactor, style, docs, chore, test.
- One logical change per commit. Sync with `git fetch origin && git rebase origin/main`. PRs are merged with **Rebase and merge** (never Squash).
- Log your key prompts in `prompts/<yourname>.md`.

## 4. Data models

| Model | Fields | Owner |
|---|---|---|
| User | name, email (unique, lowercase), passwordHash (select:false), role `CANDIDATE\|PROCTOR\|ADMIN`, isActive | Tanush |
| Exam | title, description, startAt, endAt, durationMin, sensitivity `LOW\|MEDIUM\|HIGH`, candidateIds[], proctorIds[], fingerprintSetId?, questions[{ _id, text, options[] }], createdBy | Tanush |
| Session | examId + candidateId (unique compound), status `ONLINE\|OFFLINE\|ENDED`, startedAt, endedAt, lastHeartbeat, flagCount, maxSeverity `NONE\|LOW\|MED\|HIGH`, userAgent, screen{w,h}, answers (Mixed) | Tanush |
| Flag | sessionId (index), examId (index), candidateId, code, severity `LOW\|MED\|HIGH`, score, evidence { signals: [{ code, severity, t, meta }], tool? }, raisedAt, reviewed (bool), reviewedBy, note, verdict `null\|SUSPICIOUS\|CLEARED` | Sohil |
| Fingerprint | name, tool, matcherType `SELECTOR\|IFRAME_SRC\|GLOBAL_VAR`, matcher, weight, severity, isActive, allowed (bool: a legit tool like Grammarly marked allowed is scored as LOW, weight 1) | Sohil |
| Threshold | sensitivity (unique), windowMs, flagScore | Sohil |

## 5. REST endpoints

| Method | Path | Access | Owner | Body / response |
|---|---|---|---|---|
| POST | /auth/register | Public creates CANDIDATE; Admin token may set any role | Tanush | `{ name, email, password, role? }` -> `{ user }` |
| POST | /auth/login | Public | Tanush | `{ email, password }` -> `{ token, user: { _id, name, email, role } }` |
| GET | /auth/me | Any | Tanush | -> `{ user }` |
| GET | /users?role=&search=&page=&limit= | Admin | Tanush | paginated users (for assignment pickers) |
| POST | /exams | Admin | Tanush | `{ title, description?, startAt, endAt, durationMin, sensitivity, questions[], candidateIds[], proctorIds[] }` |
| GET | /exams?page=&limit=&search= | Any | Tanush | role-scoped: admin all, proctor assigned, candidate assigned (no questions, no id lists) |
| GET | /exams/:id | Assigned or Admin | Tanush | candidate: title, times, durationMin, questions. Proctor/admin: full, with candidates/proctors populated `{ _id, name, email }` |
| PATCH | /exams/:id | Admin | Tanush | partial update, including assignments |
| POST | /exams/:id/sessions | Candidate (assigned, inside window) | Tanush | `{ userAgent?, screen? }` -> `{ sessionId, examId, startedAt, resumed }`. Resumes existing session; 409 if already ENDED |
| POST | /sessions/:id/end | Candidate (own) | Tanush | `{ answers? }` -> `{ session }`; emits `session:status` ENDED |
| GET | /exams/:id/sessions?status=&search=&page=&limit= | Proctor (assigned) or Admin | Tanush | items `{ _id, candidate: { _id, name, email }, status, flagCount, maxSeverity, startedAt, lastHeartbeat }`; limit up to 500 |
| GET | /sessions/:id | Proctor or Admin | Tanush | session + candidate + exam `{ _id, title }` |
| GET | /sessions/:id/flags | Proctor or Admin | Sohil | `{ items: Flag[] }` sorted by raisedAt ascending |
| PATCH | /flags/:id | Proctor or Admin | Sohil | `{ reviewed?, note?, verdict? }` -> flag; emits `flag:updated` |
| POST | /sessions/:id/signals | Candidate (own) | Sohil | `{ signals[] }` HTTP fallback, same `processBatch` as the socket |
| GET | /fingerprints/active | Any logged-in | Sohil | active fingerprints for the detector |
| GET, POST | /admin/fingerprints | Admin | Sohil | list / create |
| PATCH | /admin/fingerprints/:id | Admin | Sohil | update (incl. isActive, allowed) |
| GET | /admin/thresholds | Admin | Sohil | list |
| PATCH | /admin/thresholds/:sensitivity | Admin | Sohil | `{ windowMs, flagScore }` |
| GET | /exams/:id/report?format=json\|csv | Proctor (own exams) or Admin | Sohil | json `{ exam, totals: { sessions, flagged, bySeverity, byCode }, candidates: [{ candidateId, name, email, status, flagCount, maxSeverity, reviewedCount, lastFlagAt }] }` or CSV download |

## 6. Realtime (Socket.IO, implemented in server/src/realtime/io.js)

Connect with `createSocket()` from `client/src/realtime/socket.js` (sends the JWT in `auth.token`).

| Event | Direction | Payload | Notes |
|---|---|---|---|
| `session:join` | candidate -> server | `{ sessionId }`, ack `{ ok, error? }` | send on every `connect` (covers reconnects) |
| `signals:batch` | candidate -> server | `{ sessionId, signals[] }`, ack `{ ok, flags }` | max 50 signals; every 2.5 s, or immediately on a HIGH signal |
| `heartbeat` | candidate -> server | `{ sessionId, focused }` | every 12 s |
| `proctor:join` | proctor -> server | `{ examId }`, ack `{ ok, summary }` | send on every `connect` |
| `proctor:leave` | proctor -> server | `{ examId }` | on unmount |
| `flag:new` | server -> proctors | `{ _id, sessionId, examId, candidate: { id, name }, severity, code, score, t, evidence }` | |
| `flag:updated` | server -> proctors | `{ _id, sessionId, reviewed, verdict, note }` | |
| `session:status` | server -> proctors | `{ sessionId, status, focused?, maxSeverity? }` | status `ONLINE\|OFFLINE\|ENDED\|FLAGGED` |
| `exam:summary` | server -> proctors | `{ examId, online, flaggedCount, unfocused, bySeverity: { LOW, MED, HIGH } }` | every 5 s |

Proctor client rules: keep **connection** (ONLINE/OFFLINE/ENDED) and **maxSeverity** as separate fields per session. `FLAGGED` only raises maxSeverity, it never changes connection. A `session:status` for an unknown sessionId means a new candidate joined: refetch the session list (debounced).

## 7. Signals and scoring

**Signal shape (client -> server):** `{ code, severity, t, key?, meta? }`
- `t` = `Date.now()`.
- `key` = stable id of the source so the server can debounce, e.g. `"sider"` or `"DIV:2147483647:a1b2"`. Omit for focus-type signals.
- `meta` = a few small numbers/strings only. Never HTML, never text the candidate typed or pasted.

| Code | Severity | Weight | Technique (PS section 5) | Emitted when |
|---|---|---|---|---|
| `KNOWN_FINGERPRINT` | HIGH | fingerprint.weight (default 10) | #3 fingerprints | a node, iframe or global var matches an active fingerprint; key = tool |
| `EXTENSION_IFRAME` | HIGH | 8 | #3 / #7 | an iframe src starts with `chrome-extension://` or `moz-extension://`; key = src origin |
| `FIXED_HIGH_Z_NODE` | MED | 5 | #1 mutation + #2 scan | position fixed/absolute, z-index > 9999, area >= 5% of viewport, outside `[data-proctor]` |
| `FOREIGN_SHADOW_ROOT` | MED | 4 | #4 | open shadowRoot on a node outside `[data-proctor]`, or a foreign element appended to `<html>` |
| `DOM_NODE_DELTA` | LOW | 2 | #6 | top-level children of body/html grow vs the baseline taken at start |
| `WINDOW_BLUR` | LOW | 1 | #5 | window blur |
| `TAB_HIDDEN` | LOW | 2 | #5 | visibilitychange to hidden |
| `BROWSER_TAB_SWITCH` | LOW | 1 | Optional Manifest V3 companion | active HTTP(S) tab changes; sanitized origin/path and title only, no page text |
| `LARGE_PASTE` | LOW | 2 | #8 | paste longer than 100 chars (meta: length only) |
| `DEVTOOLS_OPEN` | LOW | 2 | #8 | outer/inner window size gap > 160px heuristic |

**Scoring (server/src/scoring, owner Sohil)**
1. **Debounce:** skip a signal if `debounce:{sessionId}:{code}:{key}` exists, otherwise set it. TTL 60 s for keyed signals, 10 s for keyless ones.
2. **Weight:** `DEFAULT_WEIGHTS[code]`. `KNOWN_FINGERPRINT` uses the fingerprint's weight (matched by `meta.tool`). A fingerprint marked `allowed` counts as weight 1, severity LOW.
3. **Window:** add weights to the session's sliding window (`win:{sessionId}`, length `threshold.windowMs` for the exam's sensitivity).
4. **Raise at most one flag per batch:** any counted HIGH signal -> HIGH flag. Otherwise if window sum >= `flagScore` -> MED if the window has a MED signal, else LOW. After a window-based flag, clear the window.
5. Flag `code` = code of the highest-weight signal. `evidence.signals` = the counted signals of this batch.
6. Pre-generate the flag `_id`, push the doc to the flag writer buffer (insertMany every 2 s + update Session flagCount/maxSeverity), call `counters.markFlagged(examId, sessionId, severity)`, return the flag for `flag:new`.
7. Ignore batches for sessions that are ENDED.

**Default thresholds:** LOW `{ windowMs: 60000, flagScore: 15 }`, MEDIUM `{ 60000, 8 }`, HIGH `{ 60000, 4 }`.
Sensitivity changes thresholds only, never which detectors run.

## 8. Client contracts

**Detector (owner Sumit)** in `client/src/detector/index.js`:
```js
const stop = startDetector({ socket, sessionId, fingerprints });
// fingerprints = result of GET /fingerprints/active (may be empty: detector has built-in defaults)
// runs all detectors, batches signals, emits signals:batch + heartbeat, falls back to HTTP when offline
stop(); // disconnects observers, clears timers, flushes remaining signals
```

**Exam page flow (owner Tanisha)**, `pages/candidate/ExamPage.jsx`:
1. `GET /exams/:examId` -> show title, questions, timer.
2. Show clear candidate exam rules: work independently, stay on the exam page/fullscreen, use only explicitly permitted resources, and do not use unauthorized websites, AI/helper tools, extensions, people, or devices. Explain that focus/integrity signals (and optional companion active-tab URL/title metadata) go to the assigned proctor for review and are not a verdict on their own. Button "I understand — Start exam".
3. `POST /exams/:examId/sessions` with `{ userAgent: navigator.userAgent, screen: { w: innerWidth, h: innerHeight } }` -> `sessionId`.
4. `GET /fingerprints/active`.
5. `socket = createSocket()`; on `connect` emit `session:join { sessionId }`.
6. `stop = startDetector({ socket, sessionId, fingerprints })`.
7. Keep a persistent "Integrity monitoring active" badge visible.
8. Submit -> `POST /sessions/:id/end { answers }` -> `stop()`, `socket.disconnect()`, success screen.
9. On unmount: `stop()` + `socket.disconnect()`.

The optional browser companion requires the browser `tabs` and `scripting` permissions, local
application host access, and must be installed
by the candidate. Without it, only ordinary exam-tab focus/visibility changes are available.

**Proctor live store (owner Tanya)**, `store/live.js` (zustand): `sessions` keyed by `_id`, `order` (array of ids), `feed` (latest 100 flags), `summary`. Tiles subscribe to their own entry (`useLive((s) => s.sessions[id])`) so one event re-renders one tile, never the whole grid.

## 9. Environment

Server `.env`: `PORT, MONGO_URI, JWT_SECRET, JWT_EXPIRES_IN, CLIENT_URL, REDIS_URL, NODE_ENV` (see `server/.env.example`).
Client `.env`: `VITE_API_URL, VITE_SOCKET_URL` (see `client/.env.example`).
Real values are shared privately by Tanush. Never commit `.env`.

## 10. Seed data (`npm run seed` in server)

| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.com | Admin@123 |
| Proctor | proctor@demo.com | Proctor@123 |
| Candidate | candidate@demo.com (and candidate2..20@demo.com) | Candidate@123 |
| Load test | loadtest1..500@demo.com | Load@123 |

Exams: "DBMS Mid-Term" (live now, MEDIUM, 20 candidates, proctor@demo.com, 5 questions, some sample flags) and "Load Test Exam" (500 load-test candidates). Default fingerprints and thresholds are seeded too.
