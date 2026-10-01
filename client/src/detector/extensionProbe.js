const CHROME_EXTENSION_ID = /^[a-p]{32}$/;
const SAFE_RESOURCE_PATH = /^[a-zA-Z0-9/_-]+\.(?:svg|png|webp)$/i;

/**
 * Best-effort check for a configured Chrome/Edge web-accessible extension
 * resource. A reachable image is positive evidence; a failed load is
 * inconclusive because the resource may be private, blocked, or unavailable.
 */
export function validateExtensionProbe(extensionId, resourcePath) {
  const id = String(extensionId || '').trim();
  const path = String(resourcePath || '').trim();
  if (!CHROME_EXTENSION_ID.test(id)) return { valid: false, reason: 'Extension ID must be 32 lowercase letters from a to p.' };
  if (!SAFE_RESOURCE_PATH.test(path) || path.startsWith('/') || path.split('/').includes('..')) {
    return { valid: false, reason: 'Use a relative .svg, .png, or .webp resource path.' };
  }
  return { valid: true, extensionId: id, resourcePath: path };
}

export function probeExtensionResource({ extensionId, resourcePath, timeoutMs = 3500 } = {}) {
  const checked = validateExtensionProbe(extensionId, resourcePath);
  if (!checked.valid) return Promise.resolve({ status: 'INVALID_INPUT', ...checked });
  if (typeof Image !== 'function') return Promise.resolve({ status: 'ERROR', reason: 'Image loading is unavailable in this browser.' });

  return new Promise(resolve => {
    const image = new Image();
    let settled = false;
    const finish = (status, reason = '') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve({ status, extensionId: checked.extensionId, resourcePath: checked.resourcePath, reason });
    };
    const timer = setTimeout(() => finish('TIMEOUT', 'The browser did not complete the resource request in time.'), timeoutMs);
    image.onload = () => image.naturalWidth > 0
      ? finish('DETECTED', 'The configured extension resource was reachable.')
      : finish('NOT_OBSERVED', 'The resource did not return a usable image.');
    image.onerror = () => finish('NOT_OBSERVED', 'The resource was not reachable from this page.');
    image.src = `chrome-extension://${checked.extensionId}/${checked.resourcePath}?probe=${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });
}

export const EXTENSION_PROBE_LIMIT = 'A failed/blocked probe does not prove the extension is absent. Only resources explicitly exposed by the extension can be observed; this check currently supports Chrome/Edge extension IDs.';
