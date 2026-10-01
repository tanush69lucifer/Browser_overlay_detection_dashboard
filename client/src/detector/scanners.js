/**
 * DOM Scanners for detecting browser overlays, foreign extension DOM injections,
 * high z-index layers, and unexpected shadow roots.
 * Respects [data-proctor] boundary to avoid false positives on platform UI.
 */

// Heuristic threshold per SPEC: z-index > 9999, area >= 5% of viewport
const HIGH_Z_INDEX_THRESHOLD = 9999;
const MIN_AREA_RATIO = 0.05;

/**
 * Checks if an element is part of legitimate proctor platform UI.
 * Any modal or portal rendered outside #root must carry [data-proctor="1"].
 */
export function isProctorElement(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return true;
  if (node.id === 'root') return true;
  if (node.hasAttribute('data-proctor') || node.closest('[data-proctor]')) return true;
  return false;
}

/**
 * Scan for fixed or absolute nodes with high z-index and significant viewport area.
 * Signal code: FIXED_HIGH_Z_NODE (MED)
 */
export function scanHighZNodes() {
  const signals = [];
  const viewportArea = window.innerWidth * window.innerHeight;
  if (viewportArea <= 0) return signals;

  // Scan body children and top-level positioned elements
  const elements = document.querySelectorAll('body *');

  for (const el of elements) {
    if (isProctorElement(el)) continue;

    try {
      const style = window.getComputedStyle(el);
      const position = style.position;

      if (position === 'fixed' || position === 'absolute') {
        const rawZ = style.zIndex;
        const zIndex = parseInt(rawZ, 10);

        if (!isNaN(zIndex) && zIndex > HIGH_Z_INDEX_THRESHOLD) {
          const rect = el.getBoundingClientRect();
          const area = rect.width * rect.height;

          if (area >= viewportArea * MIN_AREA_RATIO) {
            const key = `${el.tagName}:${zIndex}:${Math.round(area)}`;
            signals.push({
              code: 'FIXED_HIGH_Z_NODE',
              severity: 'MED',
              t: Date.now(),
              key,
              meta: {
                tagName: el.tagName,
                zIndex,
                areaRatio: +(area / viewportArea).toFixed(3),
              },
            });
          }
        }
      }
    } catch {
      // Ignore styling access errors on detached nodes
    }
  }

  return signals;
}

/**
 * Scan for iframes loaded from browser extension origins.
 * Signal code: EXTENSION_IFRAME (HIGH)
 */
export function scanExtensionIframes() {
  const signals = [];
  const iframes = document.querySelectorAll('iframe');

  for (const iframe of iframes) {
    if (isProctorElement(iframe)) continue;

    const src = iframe.src || '';
    if (src.startsWith('chrome-extension://') || src.startsWith('moz-extension://')) {
      try {
        const urlObj = new URL(src);
        const originKey = urlObj.origin || src.slice(0, 50);

        signals.push({
          code: 'EXTENSION_IFRAME',
          severity: 'HIGH',
          t: Date.now(),
          key: originKey,
          meta: {
            src: src.slice(0, 100),
          },
        });
      } catch {
        signals.push({
          code: 'EXTENSION_IFRAME',
          severity: 'HIGH',
          t: Date.now(),
          key: src.slice(0, 50),
          meta: { src: src.slice(0, 100) },
        });
      }
    }
  }

  return signals;
}

/**
 * Scan for open shadow roots outside [data-proctor] and foreign elements appended directly to <html>.
 * Signal code: FOREIGN_SHADOW_ROOT (MED)
 */
export function scanShadowRoots() {
  const signals = [];

  // Check <html> direct children outside <head> and <body>
  const htmlChildren = document.documentElement.children;
  for (const child of htmlChildren) {
    const tag = child.tagName.toLowerCase();
    if (tag !== 'head' && tag !== 'body') {
      if (!isProctorElement(child)) {
        signals.push({
          code: 'FOREIGN_SHADOW_ROOT',
          severity: 'MED',
          t: Date.now(),
          key: `${child.tagName}:html_child`,
          meta: {
            tagName: child.tagName,
            type: 'HTML_DIRECT_CHILD',
          },
        });
      }
    }
  }

  // Scan elements for open shadow roots
  const candidates = document.querySelectorAll('body *');
  for (const el of candidates) {
    if (isProctorElement(el)) continue;

    if (el.shadowRoot) {
      signals.push({
        code: 'FOREIGN_SHADOW_ROOT',
        severity: 'MED',
        t: Date.now(),
        key: `${el.tagName}:shadow`,
        meta: {
          tagName: el.tagName,
          type: 'OPEN_SHADOW_ROOT',
        },
      });
    }
  }

  return signals;
}

/**
 * Checks if top-level body children have grown versus the recorded baseline at exam start.
 * Signal code: DOM_NODE_DELTA (LOW)
 */
export function checkNodeDelta(baselineCount) {
  const currentCount = document.body ? document.body.children.length : 0;
  if (currentCount > baselineCount) {
    return [
      {
        code: 'DOM_NODE_DELTA',
        severity: 'LOW',
        t: Date.now(),
        key: 'body_children',
        meta: {
          baseline: baselineCount,
          current: currentCount,
        },
      },
    ];
  }
  return [];
}
