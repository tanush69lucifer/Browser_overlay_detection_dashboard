# Overlay Proctor: PS 05 | Team <Team Name>

Live exam-integrity dashboard that detects browser AI overlay extensions during a monitored test and flags them to proctors in real time, designed for 500 concurrent candidates.

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
TODO

## Features
TODO

## Architecture
TODO

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
TODO
