# Demo Overlay Extension (Alt+O Helper)

A Manifest V3 extension simulating an unauthorized floating AI assistant overlay (such as Sider, Monica, or custom overlay injectors).

## Purpose
Used during proctoring demonstrations and test evaluation to show real-time detection of high z-index layers and browser-level assistive overlays.

## Installation in Chrome / Brave / Edge
1. Open `chrome://extensions` in your browser.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select this directory (`demo-overlay`).

## Usage
- Start an assigned candidate exam with monitoring active.
- In Admin > Fingerprints, make sure the `Demo overlay extension` matcher is
  `#proctor-demo-overlay`, active, and selected for the exam's fingerprint set.
- Open the candidate exam page (`http://localhost:5175/candidate/exam/:id`).
- Press **Alt+O** (or click the extension puzzle piece icon).
- The floating AI overlay appears in the top-right corner.
- The client detector should report a `KNOWN_FINGERPRINT` signal (HIGH) and may
  also report `FIXED_HIGH_Z_NODE`. The persistent-overlay heuristic escalates
  after five seconds if the node is large enough in the current viewport.
- The Proctor live feed receives the signal; high-severity detections raise a flag.
- Press **Alt+O** again to dismiss the overlay.

This is a controlled detector-test helper, not part of the production exam flow.
Use it only in a test exam/session.

## Test extension-resource probing

The extension exposes only `probe.svg` as a web-accessible image. This is a
test fixture for the detector's best-effort resource probe; it does not expose
the extension's scripts or private data.

1. Reload this unpacked extension from `chrome://extensions` after changing its
   manifest, then copy its 32-character ID.
2. Open `http://127.0.0.1:5173/detector-test.html` and paste that ID into the
   **Extension resource probe** box. Leave the path as `probe.svg` and run it.
3. Expected positive result: `DETECTED` and an `EXTENSION_RESOURCE_PROBE`
   row in the signal stream.
4. Try a valid-looking but uninstalled ID, or change the path to `missing.svg`.
   Expected result: `NOT_OBSERVED`, with no suspicious signal generated.
5. Try an invalid ID such as `not-an-extension`. Expected result:
   `INVALID_INPUT`, explaining the expected ID format.

Interpretation: only a successful load proves that this specific configured
resource is reachable from the page. A failed, blocked, timed-out, or absent
resource is inconclusive; many extensions expose no web-accessible resources.
This probe is Chrome/Edge-specific, is not a universal extension inventory,
and does not identify an extension's behavior or prove cheating.
