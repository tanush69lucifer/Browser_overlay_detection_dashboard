# Demo overlay extension

This Manifest V3 extension adds a synthetic assistant panel to a page. It is only for controlled detector testing; it does not read page text or send data anywhere.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Choose this `demo-overlay` directory.
5. Open the Vite app's `client/detector-test.html` page (for example, `http://localhost:5173/detector-test.html`).
6. Wait about three seconds. Press **Alt + O** to hide or show the panel.

The overlay uses a high z-index, a fixed position, an open shadow root, and the `#ai-overlay-demo` fingerprint to exercise the detector. Vite must serve the `client` directory as its project root for the suggested URL; adapt the URL to your setup if needed.
