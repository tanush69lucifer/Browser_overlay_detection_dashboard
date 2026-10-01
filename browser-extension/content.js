const PAGE_SOURCE = 'overlay-proctor-page';
const EXTENSION_SOURCE = 'overlay-proctor-extension';
const SESSION_ID_PATTERN = /^[a-f\d]{24}$/i;

if (globalThis.__overlayProctorCompanionInjected) {
  // Avoid registering duplicate handlers if the extension injects into an open exam tab.
} else {
globalThis.__overlayProctorCompanionInjected = true;

function notifyPage(type, payload = {}) {
  window.postMessage(
    { source: EXTENSION_SOURCE, type, ...payload },
    window.location.origin
  );
}

function sendToWorker(message, callback) {
  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        callback?.({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      callback?.(response || { ok: false, error: 'No response from extension' });
    });
  } catch (error) {
    callback?.({ ok: false, error: error.message });
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  if (event.data?.source !== PAGE_SOURCE) return;

  if (event.data.type === 'SESSION_START') {
    if (!window.location.pathname.startsWith('/candidate/exam/')) return;
    if (typeof event.data.sessionId !== 'string' || !SESSION_ID_PATTERN.test(event.data.sessionId)) return;
    sendToWorker(
      { type: 'SESSION_START', sessionId: event.data.sessionId },
      (response) => notifyPage('EXTENSION_STATUS', response)
    );
  }

  if (event.data.type === 'SESSION_STOP') {
    sendToWorker({ type: 'SESSION_STOP' }, (response) => {
      if (!response?.ok) notifyPage('EXTENSION_STATUS', response);
    });
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'BROWSER_TAB_SWITCH') {
    notifyPage(message.type, { metadata: message.metadata });
  }
});

notifyPage('EXTENSION_READY');
}
