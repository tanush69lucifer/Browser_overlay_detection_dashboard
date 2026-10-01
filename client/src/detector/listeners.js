/**
 * Event listeners for window blur, tab visibility changes, large paste events,
 * and browser DevTools window gap heuristics.
 */

const DEVTOOLS_GAP_THRESHOLD = 160;
export function setupListeners(onSignal, onImmediateSignal = () => {}) {
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
    onImmediateSignal();
  };

  // 2. Tab visibility changes (LOW)
  const handleVisibilityChange = () => {
    onSignal({
      code: document.hidden ? 'TAB_HIDDEN' : 'TAB_VISIBLE',
      severity: 'LOW',
      t: Date.now(),
      meta: { visibilityState: document.visibilityState },
    });
    onImmediateSignal();
  };

  // 3. Paste event (LOW). Do not inspect clipboard contents.
  const handlePaste = () => {
    onSignal({
      code: 'PASTE_EVENT',
      severity: 'LOW',
      t: Date.now(),
      meta: { eventType: 'paste' },
    });
    onImmediateSignal();
  };

  // Fullscreen exit while exam monitoring is active (metadata only).
  const handleFullscreenChange = () => {
    if (document.fullscreenElement) return;
    onSignal({
      code: 'FULLSCREEN_EXIT',
      severity: 'LOW',
      t: Date.now(),
      meta: { eventType: 'fullscreen-exit' },
    });
    onImmediateSignal();
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
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  window.addEventListener('resize', checkDevTools);

  // Initial check for DevTools
  checkDevTools();

  // Teardown cleanup function
  return () => {
    window.removeEventListener('blur', handleBlur);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('paste', handlePaste, true);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    window.removeEventListener('resize', checkDevTools);
  };
}
