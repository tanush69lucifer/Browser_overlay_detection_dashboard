/**
 * Built-in default fingerprints for common unauthorized overlay tools,
 * floating AI assistants, and browser extensions.
 * Supplemented dynamically by GET /fingerprints/active from the server.
 */
export const DEFAULT_FINGERPRINTS = [
  {
    name: 'Sider AI Sidebar',
    tool: 'SIDER',
    matcherType: 'SELECTOR',
    matcher: '#sider-sidebar-root, #sider-quick-bar, sider-sidebar, [id^="sider-"]',
    weight: 10,
    severity: 'HIGH',
  },
  {
    name: 'Monica AI Assistant',
    tool: 'MONICA',
    matcherType: 'SELECTOR',
    matcher: '#monica-root, .monica-widget-wrapper, [data-monica-root]',
    weight: 10,
    severity: 'HIGH',
  },
  {
    name: 'ChatGPT / Claude Floating Extension',
    tool: 'CHATGPT_EXT',
    matcherType: 'SELECTOR',
    matcher: '#chatgpt-overlay, #chatgpt-sidebar-root, [class*="chatgpt-sidebar"]',
    weight: 10,
    severity: 'HIGH',
  },
  {
    name: 'Harpa AI Assistant',
    tool: 'HARPA',
    matcherType: 'SELECTOR',
    matcher: '#harpa-app, #harpa-root, .harpa-element',
    weight: 10,
    severity: 'HIGH',
  },
  {
    name: 'Merlin AI',
    tool: 'MERLIN',
    matcherType: 'SELECTOR',
    matcher: '#merlin-overlay, [data-merlin-root]',
    weight: 10,
    severity: 'HIGH',
  },
  {
    name: 'Grammarly Helper',
    tool: 'GRAMMARLY',
    matcherType: 'SELECTOR',
    matcher: 'grammarly-extension, [data-grammarly-part]',
    weight: 1, // Legit extension marked allowed = weight 1, severity LOW per SPEC
    severity: 'LOW',
    allowed: true,
  },
  {
    name: 'Demo Overlay Extension',
    tool: 'DEMO_OVERLAY',
    matcherType: 'SELECTOR',
    matcher: '#proctor-demo-overlay, .proctor-demo-overlay-active',
    weight: 10,
    severity: 'HIGH',
  },
  {
    name: 'Extension Iframe Source Match',
    tool: 'CHROME_EXT_IFRAME',
    matcherType: 'IFRAME_SRC',
    matcher: 'chrome-extension://',
    weight: 8,
    severity: 'HIGH',
  },
];

/**
 * Matches active or default fingerprints against the live document.
 * @param {Array} fingerprints - Combined list of server & default fingerprints
 * @returns {Array} List of matched signals
 */
export function scanFingerprints(fingerprints = []) {
  const list = fingerprints.length > 0 ? fingerprints : DEFAULT_FINGERPRINTS;
  const matches = [];

  for (const fp of list) {
    if (fp.isActive === false) continue;

    try {
      if (fp.matcherType === 'SELECTOR' && fp.matcher) {
        const found = document.querySelector(fp.matcher);
        if (found && !found.closest('[data-proctor]')) {
          matches.push({
            code: 'KNOWN_FINGERPRINT',
            severity: fp.allowed ? 'LOW' : (fp.severity || 'HIGH'),
            weight: fp.allowed ? 1 : (fp.weight || 10),
            t: Date.now(),
            key: fp.tool || 'UNKNOWN_TOOL',
            meta: {
              tool: fp.tool,
              name: fp.name,
              type: 'SELECTOR',
              allowed: Boolean(fp.allowed),
            },
          });
        }
      } else if (fp.matcherType === 'IFRAME_SRC' && fp.matcher) {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          if (iframe.closest('[data-proctor]')) continue;
          const src = iframe.src || '';
          if (src.includes(fp.matcher)) {
            matches.push({
              code: 'KNOWN_FINGERPRINT',
              severity: fp.allowed ? 'LOW' : (fp.severity || 'HIGH'),
              weight: fp.allowed ? 1 : (fp.weight || 10),
              t: Date.now(),
              key: fp.tool || 'IFRAME_TOOL',
              meta: {
                tool: fp.tool,
                name: fp.name,
                type: 'IFRAME_SRC',
              },
            });
            break;
          }
        }
      } else if (fp.matcherType === 'GLOBAL_VAR' && fp.matcher) {
        if (typeof window !== 'undefined' && window[fp.matcher] !== undefined) {
          matches.push({
            code: 'KNOWN_FINGERPRINT',
            severity: fp.allowed ? 'LOW' : (fp.severity || 'HIGH'),
            weight: fp.allowed ? 1 : (fp.weight || 10),
            t: Date.now(),
            key: fp.tool || fp.matcher,
            meta: {
              tool: fp.tool,
              name: fp.name,
              type: 'GLOBAL_VAR',
            },
          });
        }
      }
    } catch {
      // Ignore invalid query selector or cross-origin access errors safely
    }
  }

  return matches;
}
