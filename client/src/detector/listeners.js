/**
 * Event listeners for window blur, tab visibility changes, large paste events,
 * and browser DevTools window gap heuristics.
 */

const DEVTOOLS_GAP_THRESHOLD = 160;
const LARGE_PASTE_THRESHOLD = 100;

export function setupListeners(onSignal) {
  // 1. Window Blur (WINDOW_BLUR - LOW)
  const handleBlur = () => {
    onSignal({
      code: 'WINDOW_BLUR',
      severity: 'LOW',
      t: Date.now(),
      meta: {
        eventType: 'blur',
      },
    });
  };

  // 2. Tab Hidden (TAB_HIDDEN - LOW)
  const handleVisibilityChange = () => {
    if (document.hidden) {
      onSignal({
        code: 'TAB_HIDDEN',
        severity: 'LOW',
        t: Date.now(),
        meta: {
          visibilityState: document.visibilityState,
        },
      });
    }
  };

  // 3. Large Paste (LARGE_PASTE - LOW)
  // Per SPEC: meta contains small numbers only. NEVER HTML, NEVER text typed or pasted.
  const handlePaste = (e) => {
    try {
      const text = e.clipboardData?.getData('text/plain') || '';
      if (text.length > LARGE_PASTE_THRESHOLD) {
        onSignal({
          code: 'LARGE_PASTE',
          severity: 'LOW',
          t: Date.now(),
          key: 'paste',
          meta: {
            length: text.length,
          },
        });
      }
    } catch {
      // Ignore clipboard read permission errors safely
    }
  };

  // 4. DevTools Open Heuristic (DEVTOOLS_OPEN - LOW)
  let lastDevtoolsCheck = 0;
  const checkDevTools = () => {
    const now = Date.now();
    if (now - lastDevtoolsCheck < 1500) return; // Debounce resize spam
    lastDevtoolsCheck = now;

    const widthGap = window.outerWidth - window.innerWidth;
    const heightGap = window.outerHeight - window.innerHeight;

    if (widthGap > DEVTOOLS_GAP_THRESHOLD || heightGap > DEVTOOLS_GAP_THRESHOLD) {
      onSignal({
        code: 'DEVTOOLS_OPEN',
        severity: 'LOW',
        t: now,
        key: 'devtools',
        meta: {
          widthGap: Math.round(widthGap),
          heightGap: Math.round(heightGap),
        },
      });
    }
  };

  window.addEventListener('blur', handleBlur);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('paste', handlePaste, true);
  window.addEventListener('resize', checkDevTools);

  // Initial check for DevTools
  checkDevTools();

  // Teardown cleanup function
  return () => {
    window.removeEventListener('blur', handleBlur);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('paste', handlePaste, true);
    window.removeEventListener('resize', checkDevTools);
  };
}
