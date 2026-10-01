# Proctor Console Engineering & Demonstration Guide

**Assigned Persona:** Tanya Goyal  
**Developer:** Sumit Chaudhary (`sumit-chaudhary11`)  
**Branch:** `feature/dashboard`  
**Repository:** `https://github.com/tanush69lucifer/Browser_overlay_detection_dashboard`

---

## 1. Scope & Ownership

You own and modify **ONLY** the following files:
```text
client/src/store/live.js
client/src/api/proctor.js
client/src/pages/proctor/ProctorHome.jsx
client/src/pages/proctor/Console.jsx
client/src/pages/proctor/SessionDetail.jsx
client/src/pages/proctor/Report.jsx
client/src/components/proctor/ExamHeader.jsx
client/src/components/proctor/SessionGrid.jsx
client/src/components/proctor/SessionTile.jsx
client/src/components/proctor/FlagFeed.jsx
client/src/components/proctor/FlagTimeline.jsx
prompts/tanya.md
```

### Shared / External Contracts (Use, Do Not Edit):
- `api/client.js` — Axios client configured with base URL, auth token interceptors, and fallback mock data.
- `realtime/socket.js` — Socket.IO client factory `createSocket()`.
- Theme tokens & Tailwind utility classes (calm dark monitoring console `#0b0f17`, dense tabular numbers using `.num`, pulse ring animation `pulse-ring-active`).
- UI components in `components/ui/*`.

---

## 2. Local Environment Setup

```bash
git config --global user.name "Tanya Goyal"
git config --global user.email "<your github email>"
git config --global pull.rebase true

git clone https://github.com/tanush69lucifer/Browser_overlay_detection_dashboard.git
cd Browser_overlay_detection_dashboard/client
npm install && cp .env.example .env
git checkout -b feature/dashboard
npm run dev
```

---

## 3. Commit Sequence

### Step 1: Data Layer
1. `feat(proctor): add proctor API helpers`
   - Added `getMyExams`, `getExam`, `getExamSessions`, `getSession`, `getSessionFlags`, `updateFlag`, `getReport`, `downloadReportCsv` with blob support.
2. `feat(proctor): add live session store with delta updates`
   - Zustand store with `loadSessions`, `applyStatus`, `applyFlag`, `applyFlagUpdate`, `setSummary`, and `reset`.
3. `feat(proctor): add proctor home with assigned exams`
   - `ProctorHome.jsx` displaying Live/Upcoming/Ended exams with quick access links.

### Step 2: Live Console
1. `feat(console): add exam header with live counts`
   - `ExamHeader.jsx` with online, flagged, high/med/low severity counters, and socket connection pill.
2. `feat(console): add virtualised session grid with status tiles`
   - `SessionGrid.jsx` and `SessionTile.jsx` with `react-virtuoso` virtualization and candidate search.
3. `feat(console): add live flag feed with pulse on new flags`
   - `FlagFeed.jsx` displaying real-time stream of incoming flags capped at 100 items.
4. `feat(console): subscribe to exam room and apply realtime deltas`
   - `Console.jsx` orchestrating Socket.IO `proctor:join`, delta listeners, and 2s debounced refetch for unknown sessions.

### Step 3: Drill-Down + Report
1. `feat(proctor): add candidate drill-down with flag timeline and evidence`
   - `SessionDetail.jsx` and `FlagTimeline.jsx` with evidence signals table and candidate technical telemetry.
2. `feat(proctor): add notes, verdict and mark-reviewed workflow`
   - Optimistic updates with in-app toast feedback and non-accusatory language.
3. `feat(report): add integrity report page with charts and CSV export`
   - `Report.jsx` with summary totals, Recharts bar charts, sortable table, and CSV download.
4. `style(console): responsive layout and empty/loading/error states`
   - Polished responsive layouts, high-contrast dark theme, and loading skeletons.

---

## 4. Demo Video Script (3–5 min, Voice-Over)

| Step | Duration | Screen Action | Voice-over Narration |
| :--- | :--- | :--- | :--- |
| **1. Admin Creation** | 30s | Show admin creating exam and assigning candidate + proctor Tanya. | *"Here the administrator schedules the CS301 Systems exam, assigns candidate Aarav Sharma and proctor Tanya Goyal."* |
| **2. Candidate Starts** | 30s | Open candidate screen with webcam & screen monitoring consent. | *"The candidate accepts proctoring consent and starts their exam session in a controlled browser window."* |
| **3. Overlay Detection** | 45s | Press **Alt+O** or activate overlay helper. Show proctor console. | *"Now the candidate presses Alt+O to invoke an unauthorized overlay tool. Within 2 seconds, the proctor console receives a real-time delta via WebSockets: Aarav's tile flashes with a 1.5s red pulse ring, severity raises to HIGH, and a new flag pops into the Live Anomaly Feed."* |
| **4. Drill-Down & Review** | 30s | Click Aarav's tile -> `SessionDetail`. Review evidence table, type note, click 'Mark Reviewed'. | *"Clicking the tile opens the candidate drill-down. Notice our strictly non-accusatory terminology: 'flagged for review'. We examine the evidence table showing window title and shortcut metadata, add a proctor observation note, and click 'Mark Reviewed' which updates optimistically."* |
| **5. Grammarly Extension Case** | 20s | Show candidate with Grammarly flag -> mark cleared. | *"When a candidate has Grammarly injected, the sensor detects the DOM mutation. The proctor reviews the syllabus policy and clears the incident as permitted."* |
| **6. High Load / Scalability** | 30s | Show 40+ candidate grid, fast scrolling, filter chips. | *"With 500+ candidates, the console uses `react-virtuoso` virtualization. Each tile subscribes only to its own store entry, maintaining a smooth 60 FPS without re-rendering the full grid."* |
| **7. Integrity Report & CSV** | 20s | Navigate to `/proctor/report/:id` -> Click 'Export CSV'. | *"After the exam, the proctor opens the Integrity Report to view charts of anomalies by code and severity, and exports the full candidate audit as a CSV blob."* |
| **8. Limitations** | 15s | Summary of `DETECTION.md`. | *"Per DETECTION.md, external physical cameras and hardware capture cards bypass browser-level detection, while software overlays and focus loss are caught reliably."* |

---

## 5. Viva Preparation: Key Technical Questions & Answers

### Q1: Why do `SessionTile` components subscribe to their own store entry instead of the parent grid passing props?
> **Answer:** If `SessionGrid` subscribed to the entire `sessions` dictionary and passed props down, ANY incoming flag or status delta for candidate #1 would cause all 500 candidate tiles to re-render. By memoizing `SessionTile` (`React.memo`) and using a granular Zustand selector:
> ```js
> const session = useLiveStore(useCallback((s) => s.sessions[sessionId], [sessionId]));
> ```
> only the specific tile whose session state changed executes a re-render. All other 499 tiles remain untouched in the DOM, keeping rendering performance at 60 FPS.

### Q2: Why use virtualization (`react-virtuoso`) for the session grid?
> **Answer:** In a standard React grid with 500 candidates, mounting 500 full tile subtrees leads to hundreds of DOM nodes, causing memory spikes and scroll jank. `VirtuosoGrid` calculates the viewport bounds and only mounts the tiles currently visible on screen (plus a small overscan buffer). As the proctor scrolls, DOM nodes are recycled efficiently.

### Q3: How does reconnecting re-join the exam room?
> **Answer:** In Socket.IO, if a temporary network disconnection occurs, the server-side socket room memberships are lost when the socket closes. In `Console.jsx`, we listen to the socket's `connect` event:
> ```javascript
> socket.on('connect', () => {
>   socket.emit('proctor:join', { examId }, (ack) => {
>     if (ack?.summary) setSummary(ack.summary);
>   });
> });
> ```
> Whenever the client reconnects, it immediately re-emits `proctor:join` with `examId` to re-enter the room and uses the acknowledgment callback to reconcile latest counters.

### Q4: Delta events vs. polling / refetching: Why is this architecture superior?
> **Answer:** Instead of continuously polling `GET /exams/:id/sessions` every few seconds (which causes massive network overhead and server strain with 500 candidates), the server broadcasts discrete event deltas:
> - `flag:new` — payload is only the new flag (~200 bytes).
> - `session:status` — payload is only `{ sessionId, status, focused, maxSeverity }` (~80 bytes).
>
> Zustand merges these deltas in memory in O(1) time. Debounced refetching (2s delay) is only used as a fallback when an unknown `sessionId` arrives, ensuring consistency without spamming the server.
