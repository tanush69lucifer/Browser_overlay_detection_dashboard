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
- Open any web page (or the exam candidate window `http://localhost:5173/candidate/exam/:id`).
- Press **Alt+O** (or click the extension puzzle piece icon).
- The floating AI overlay appears in the top-right corner.
- Within 2 seconds, the client detector captures:
  - `FIXED_HIGH_Z_NODE` (MED)
  - `KNOWN_FINGERPRINT` (HIGH)
- The Proctor Console immediately receives the signal delta, flashes a 1.5s red pulse ring, and raises candidate severity to HIGH.
- Press **Alt+O** again to dismiss the overlay.
