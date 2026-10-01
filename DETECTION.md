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

The detector evaluates nine distinct integrity telemetry signals per SPEC Section 7:

| Code | Severity | Default Weight | Technique & Detection Logic | Trigger Condition |
| :--- | :---: | :---: | :--- | :--- |
| **`KNOWN_FINGERPRINT`** | **HIGH** | 10 | **Signature Matching**<br>Scans DOM selectors, iframe URLs, and global `window` variables for signatures of known AI assistants (Sider, Monica, Copilot, Harpa). | Matched active fingerprint outside `[data-proctor]`. Key = tool identifier. |
| **`EXTENSION_IFRAME`** | **HIGH** | 8 | **Extension Origin Inspection**<br>Inspects all iframe elements for `chrome-extension://` or `moz-extension://` source protocols. | An iframe source matches extension protocol. Key = origin string. |
| **`FIXED_HIGH_Z_NODE`** | **MED** | 5 | **Heuristic Layer Scan**<br>Calculates computed styles for fixed/absolute positioned nodes with $z\text{-index} > 9999$ and visual area $\ge 5\%$ of viewport. | Unapproved high z-index overlay layer detected outside `[data-proctor]`. |
| **`FOREIGN_SHADOW_ROOT`** | **MED** | 4 | **Shadow DOM Encapsulation Traversal**<br>Detects open shadow roots outside platform UI or direct children attached to `<html>`. | Open shadow DOM or foreign `<html>` child node. |
| **`DOM_NODE_DELTA`** | **LOW** | 2 | **Top-Level DOM Baseline Diff**<br>Monitors top-level children count of `<body>` and `<html>` against initial exam start baseline. | Unregistered nodes injected into document root. |
| **`WINDOW_BLUR`** | **LOW** | 1 | **Window Blur Event**<br>`window.addEventListener('blur')` | Candidate switches focus to another application or window. |
| **`TAB_HIDDEN`** | **LOW** | 2 | **Visibility API Transition**<br>`document.addEventListener('visibilitychange')` | Exam tab moved to background or minimized (`document.hidden === true`). |
| **`LARGE_PASTE`** | **LOW** | 2 | **Clipboard Telemetry**<br>`window.addEventListener('paste')` | Paste event with $> 100$ characters. **Captures length only; never text**. |
| **`DEVTOOLS_OPEN`** | **LOW** | 2 | **Viewport Differential Heuristic**<br>Measures differential between outer and inner window dimensions. | Gap $(window.outer - window.inner) > 160\text{px}$. |

---

## 3. False-Positive Protection & Boundary Rules

To prevent candidate platform UI from triggering false alarms:

1. **`[data-proctor="1"]` Boundary Enforcement:**
   All candidate application elements inside `#root` and any portals (modals, dialogs, toasts) carry `data-proctor="1"`. The detector traverses parent chains via `node.closest('[data-proctor]')` and ignores all internal elements.
2. **Dynamic Fingerprint Whitelisting:**
   Permitted tools (such as institutional spell-checkers or Grammarly) configured as `allowed: true` on the server are dynamically downscaled to severity `LOW` with weight `1`, preventing unwarranted alarm escalation.
3. **Local Client Deduplication:**
   Keyed signals (e.g., specific overlay tool IDs) are throttled with a 6-second client-side debounce window to avoid event flooding.

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
2. **Immediate HIGH Priority Flush:** Any `HIGH` severity detection (`KNOWN_FINGERPRINT` or `EXTENSION_IFRAME`) bypasses the interval timer and flushes immediately, giving proctors sub-2-second alerts.
3. **Automatic HTTP Fallback:** If the WebSocket connection drops, signals are seamlessly transmitted via `POST /api/v1/sessions/:id/signals`.
4. **12-Second Heartbeat:** The candidate client sends `heartbeat` with `{ sessionId, focused: document.hasFocus() && !document.hidden }` every 12 seconds to ensure continuous connectivity awareness.

---

## 5. Security & Privacy Guarantees

* **Zero Keystroke Logging:** The detector does not capture keyboard inputs or typed responses.
* **Paste Privacy:** The browser exposes the pasted text to the paste event; the detector measures its length in memory, then only the length integer (`meta.length`) is transmitted. It does not retain or send the text.
* **No Video/Camera Surveillance:** Works entirely through client browser telemetry without requiring webcam hardware.
* **Ethical Language:** Candidate events are recorded strictly as *"flagged for review"*, preserving due process for proctor verification.

---

## 6. Hardware & Physical Limitations

As highlighted in the system architecture and viva assessment:
1. **External Physical Hardware:** Secondary physical monitors connected via external HDMI splitters that clone the display without triggering OS virtual display events cannot be detected through JavaScript browser APIs.
2. **External Physical Devices:** Mobile phones, second laptops, or camera setups positioned physically off-screen are outside browser sandbox visibility.
3. **Kernel-Level OS Overlays:** Custom OS-level DirectX/DirectComposition overlays injected without altering window focus or DOM structures operate outside the browser sandbox. However, software browser extensions, DOM injectors, and window switching are captured reliably.
