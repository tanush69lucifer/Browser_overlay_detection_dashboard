# Browser Overlay Detection Engine (DETECTION.md)

**Owner:** Sumit Chaudhary (`sumit-chaudhary11`)  
**Specification:** PS05 Browser Overlay Detection Dashboard  
**Layer:** Client Detector (`client/src/detector/*`)

---

## 1. Executive Summary

Modern academic dishonesty often relies on software overlays, AI sidebars (Sider, Monica, Copilot, ChatGPT), and floating browser extensions that hover over exam windows to provide unauthorized assistance. Traditional proctoring tools frequently resort to invasive webcam surveillance or OS kernel-level spyware.

Cluely is included as a configurable/best-effort DOM fingerprint (`id`/`class` containing `cluely`, or `cluely-overlay` / `cluely-assistant`). Detection works only when the tool exposes a footprint to the exam page DOM or triggers one of the browser focus/visibility signals. A separate desktop window or browser-chrome overlay is outside page JavaScript's visibility; the detector must not claim that it identified Cluely by brand in that case.

This engine introduces a **lightweight, privacy-first client-side detector** running directly in the browser sandbox. It evaluates DOM mutations, computed CSS properties, shadow roots, iframe origins, window focus states, and extension fingerprints in real-time—streaming compact telemetry deltas without capturing keystrokes or camera feeds.

---

## 2. Detection Techniques & Signals

The candidate detector combines a `MutationObserver`, periodic DOM scans, configured
fingerprints, and browser event metadata. Fingerprints are limited to the set selected
for the active exam. Detection is heuristic: browser JavaScript cannot inspect every
extension, another application, or browser-protected surface.

| Code | Severity | Default Weight | Technique & Detection Logic | Trigger Condition |
| :--- | :---: | :---: | :--- | :--- |
| **`KNOWN_FINGERPRINT`** | Configured | Configured | **Signature Matching**<br>Supports configured DOM selectors, iframe URL fragments, and global variables. | Matched active fingerprint outside `[data-proctor]`. |
| **`EXTENSION_IFRAME`** | **HIGH** | 8 | **Extension Origin Inspection**<br>Inspects all iframe elements for `chrome-extension://` or `moz-extension://` source protocols. | An iframe source matches extension protocol. Key = origin string. |
| **`FIXED_HIGH_Z_NODE`** | **MED**, then **HIGH** if persistent | 5 | **Heuristic Layer Scan**<br>Checks fixed/absolute nodes with `z-index > 9999` and area at least 5% of viewport. | A matching node appears; it escalates after 5 seconds of continued presence. |
| **`FOREIGN_SHADOW_ROOT`** | **MED** | 4 | **Shadow DOM Encapsulation Traversal**<br>Detects open shadow roots outside platform UI or direct children attached to `<html>`. | Open shadow DOM or foreign `<html>` child node. |
| **`DOM_NODE_DELTA`** | **LOW** | 2 | **Top-Level DOM Baseline Diff**<br>Monitors top-level children count of `<body>` and `<html>` against initial exam start baseline. | Unregistered nodes injected into document root. |
| **`WINDOW_BLUR`** | **LOW** | 1 | **Window Blur Event**<br>`window.addEventListener('blur')` | Candidate switches focus to another application or window. |
| **`TAB_HIDDEN`** | **LOW** | 2 | **Visibility API Transition**<br>`document.addEventListener('visibilitychange')` | Exam tab moved to background or minimized (`document.hidden === true`). |
| **`BROWSER_TAB_SWITCH`** | **LOW** | 1 | **Optional Manifest V3 companion**<br>Uses the browser tabs API only during an explicitly started exam. | Active HTTP(S) tab changes; reports sanitized origin/path, title, and whether the candidate returned to the exam tab. |
| **`PASTE_EVENT`** | **LOW** | 1 | **Paste event metadata**<br>Observes the paste event only. | A paste event occurs. Clipboard contents and length are not read. |
| **`FULLSCREEN_EXIT`** | **LOW** | 1 | **Fullscreen state**<br>`fullscreenchange` event. | Candidate exits fullscreen while monitoring is active. |
| **`DEVTOOLS_OPEN`** | **LOW** | 2 | **Viewport Differential Heuristic**<br>Measures differential between outer and inner window dimensions. | Gap $(window.outer - window.inner) > 160\text{px}$. |

---

## 3. False-Positive Protection & Boundary Rules

To prevent candidate platform UI from triggering false alarms:

1. **`[data-proctor="1"]` Boundary Enforcement:**
   All candidate application elements inside `#root` and any portals (modals, dialogs, toasts) carry `data-proctor="1"`. The detector traverses parent chains via `node.closest('[data-proctor]')` and ignores all internal elements.
2. **Dynamic Fingerprint Whitelisting:**
   Permitted tools (such as institutional spell-checkers or Grammarly) configured as `allowed: true` on the server are dynamically downscaled to severity `LOW` with weight `1`, preventing unwarranted alarm escalation.
3. **Appearance/change deduplication:**
   The scanner reports a matching node on first appearance and again only when its
   signature changes or it disappears and reappears. Persistent positioned overlays
   are rescanned to detect the 5-second severity escalation.

---

## 4. Signal Batching & Transmission

```
[DOM Mutations / Events]
           │
           ▼
┌───────────────────────┐
│  Client Detector      │
│  - Heuristic Scanners │
│  - Fingerprint Engine │
│  - Local Deduplicator │
└──────────┬────────────┘
           │ Enqueue signal
           ▼
┌──────────────────────────────────────────────┐
│  Signal Batcher & Dispatcher                 │
│  - Dispatches every 2.5s (max 50 signals)    │
│  - IMMEDIATE dispatch on any HIGH signal     │
└──────────┬──────────────────────┬────────────┘
           │ Socket.IO            │ Fallback (offline)
           ▼                      ▼
┌───────────────────────┐ ┌────────────────────┐
│ Socket: signals:batch │ │ HTTP: POST signals │
└───────────────────────┘ └────────────────────┘
```

1. **2.5-Second Batching Window:** Normal low and medium severity signals are queued and flushed in batches of up to 50 items every 2.5 seconds to conserve candidate bandwidth.
2. **Immediate HIGH Priority Flush:** A signal marked `HIGH` bypasses the interval timer. Delivery time still depends on the client connection and server response.
3. **Socket acknowledgement and HTTP fallback:** If the socket is disconnected or the signal batch is not acknowledged, the client tries `POST /api/v1/sessions/:id/signals`; undelivered signals remain in a per-session local queue for retry.
4. **12-Second Heartbeat:** The candidate client sends `heartbeat` with `{ sessionId, focused: document.hasFocus() && !document.hidden }` every 12 seconds to ensure continuous connectivity awareness.

---

## 5. Security & Privacy Guarantees

* **Zero Keystroke Logging:** The detector does not capture keyboard inputs or typed responses.
* **No Clipboard Inspection:** Paste detection records only that a paste event occurred. It does not read clipboard contents or text length.
* **No Video/Camera Surveillance:** Works entirely through client browser telemetry without requiring webcam hardware.
* **Optional active-tab metadata:** The separate browser companion uses the browser's `tabs` permission and local-app host access to report only the active HTTP(S) tab's origin/path and title during an active exam; query strings and fragments are removed. It can inject its bridge into an already-open local exam tab when installed or reloaded. It does not read page text or collect browsing history, and copying a URL without switching tabs or navigating is not detectable. Without the companion, only the exam page's ordinary focus/visibility events are available.
* **Flag evidence retention:** Signals are processed in memory/Redis; when signals contribute to a flag, their compact metadata is retained in that flag's evidence for Proctor review. This includes sanitized active-tab origin/path and title when the companion is installed.
* **Ethical Language:** Candidate events are recorded strictly as *"flagged for review"*, preserving due process for proctor verification.

---

## 6. Hardware & Physical Limitations

As highlighted in the system architecture and viva assessment:
1. **External Physical Hardware:** Secondary physical monitors connected via external HDMI splitters that clone the display without triggering OS virtual display events cannot be detected through JavaScript browser APIs.
2. **External Physical Devices:** Mobile phones, second laptops, or camera setups positioned physically off-screen are outside browser sandbox visibility.
3. **Browser and OS boundaries:** A browser detector cannot guarantee detection of every extension or OS overlay. DOM injection, configured signatures, supported extension iframe origins, focus/visibility transitions, and fullscreen changes are observable signals, but heuristics can miss tools and produce false positives.
