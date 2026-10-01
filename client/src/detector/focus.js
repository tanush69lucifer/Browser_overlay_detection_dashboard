import { DETECTOR_CONFIG, SEVERITIES, SIGNAL_CODES } from './config.js';

export function startFocusSignals(onSignal) {
  if (typeof onSignal !== 'function') return () => {};
  const emit = (code, key, meta = {}) => onSignal({ code, severity: SEVERITIES.LOW, key, t: Date.now(), meta });
  const onBlur = () => emit(SIGNAL_CODES.WINDOW_BLUR, 'window-blur');
  const onVisibility = () => { if (document.hidden) emit(SIGNAL_CODES.TAB_HIDDEN, 'tab-hidden'); };
  let recentPageCopyAt = 0;
  const onCopy = () => { recentPageCopyAt = Date.now(); };
  const onPaste = event => {
    const text = event.clipboardData?.getData('text') || '';
    const copiedFromThisPage = recentPageCopyAt > 0 && Date.now() - recentPageCopyAt <= 5000;
    recentPageCopyAt = 0;
    if (copiedFromThisPage) return;
    if (text.length > DETECTOR_CONFIG.largePasteLength) emit(SIGNAL_CODES.LARGE_PASTE, `large-paste:${Date.now()}`, { length: text.length });
  };
  let devtoolsOpen = false;
  const checkDevtools = () => {
    const gap = Math.max(window.outerWidth - window.innerWidth, window.outerHeight - window.innerHeight);
    const currentlyOpen = gap > DETECTOR_CONFIG.devtoolsGapPx;
    if (currentlyOpen && !devtoolsOpen) emit(SIGNAL_CODES.DEVTOOLS_OPEN, 'devtools-open');
    devtoolsOpen = currentlyOpen;
  };

  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('copy', onCopy, true);
  document.addEventListener('paste', onPaste, true);
  window.addEventListener('resize', checkDevtools);
  checkDevtools();

  return () => {
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('copy', onCopy, true);
    document.removeEventListener('paste', onPaste, true);
    window.removeEventListener('resize', checkDevtools);
  };
}
