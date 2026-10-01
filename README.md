# Overlay Proctor: PS 05

Overlay Proctor is an exam-integrity dashboard for online assessments. During an exam, its browser-based detector looks for signals associated with AI assistant overlays and browser extensions, then sends compact alerts to a live proctor dashboard for human review. The system is designed to support load testing with up to 500 concurrent candidate sessions.

The detector uses browser-visible signals such as known extension fingerprints, injected high-layer page elements, focus changes, and tab visibility. It does not record keystrokes, read pasted text, or use a camera. A signal is an indicator for review; it is not proof of misconduct.

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
- **Client:** React 18, Vite, Tailwind CSS 4, React Router, Zustand, Axios, Socket.IO client, and Recharts.
- **Server:** Node.js, Express, MongoDB with Mongoose, Socket.IO, and Redis (optional, with in-memory fallbacks for Redis-backed features).
- **Authentication and validation:** JWT, bcrypt, and Zod.

## Features
- Role-based experiences for candidates, proctors, and administrators.
- Exam creation and assignment, candidate exam sessions, and answer submission.
- Browser-side overlay and extension signal detection, including configurable fingerprints and sensitivity thresholds.
- Live proctor monitoring with session status, severity summaries, incoming flags, and candidate drill-down reports.
- Real-time signal delivery over Socket.IO with an HTTP fallback when the socket is unavailable.
- JSON and CSV exam reports, plus a seeded demo environment and load-test tooling.

## Architecture
The React client hosts the candidate exam, detector, admin pages, and live proctor console. The Express API handles authentication, exams, sessions, fingerprints, thresholds, and reports. Candidate clients batch small signal records and send them to the server; the scoring service applies debounce and sensitivity thresholds, stores review flags, and publishes updates to proctors over Socket.IO. MongoDB stores application records, while Redis supports live counters, signal windows, debounce keys, and the Socket.IO adapter when configured.

See [SPEC.md](SPEC.md) for API, data model, signal, and realtime event details.

## Detection: what we can and cannot detect
See [DETECTION.md](DETECTION.md).

## Scale: load test results
See [LOADTEST.md](LOADTEST.md).

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
- Detection is limited to information available inside the browser page. Physical second devices, undetectable OS-level overlays, and other activity outside the browser sandbox cannot be observed.
- Browser heuristics can produce false positives or miss overlays that do not expose detectable fingerprints or page changes. Proctors should review flags in context.
- The live deployment URLs and demo video have not been filled in yet.
