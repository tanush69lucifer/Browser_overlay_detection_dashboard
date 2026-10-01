const SESSION_KEY = 'activeExamSession';
const lastReportedBySession = new Map();
const APP_HOST_MATCHES = ['http://localhost/*', 'http://127.0.0.1/*'];

async function injectIntoOpenExamTabs() {
  const tabs = await chrome.tabs.query({ url: APP_HOST_MATCHES });
  await Promise.all(tabs
    .filter((tab) => tab.id && tab.url && new URL(tab.url).pathname.startsWith('/candidate/exam/'))
    .map(async (tab) => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
      } catch (error) {
        console.warn('[Overlay Proctor] Could not connect to an already-open exam tab:', error.message);
      }
    }));
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install' || reason === 'update') {
    void injectIntoOpenExamTabs().catch((error) => {
      console.error('[Overlay Proctor] Unable to connect existing exam tabs:', error.message);
    });
  }
});

chrome.runtime.onStartup.addListener(() => {
  void injectIntoOpenExamTabs().catch((error) => {
    console.error('[Overlay Proctor] Unable to reconnect restored exam tabs:', error.message);
  });
});

async function readSession() {
  const stored = await chrome.storage.session.get(SESSION_KEY);
  return stored[SESSION_KEY] || null;
}

function cleanTabMetadata(tab) {
  if (typeof tab.url !== 'string' || typeof tab.title !== 'string') return null;
  try {
    const parsed = new URL(tab.url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return {
      url: `${parsed.origin}${parsed.pathname}`.slice(0, 200),
      title: tab.title.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120),
    };
  } catch {
    return null;
  }
}

async function reportActiveTab(tabId) {
  const session = await readSession();
  if (!session) return;

  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return;
  }
  const metadata = cleanTabMetadata(tab);
  if (!metadata) return;

  const isExamTab = tabId === session.examTabId;
  const dedupeKey = `${tabId}|${metadata.url}|${metadata.title}`;
  if (lastReportedBySession.get(session.sessionId) === dedupeKey) return;
  lastReportedBySession.set(session.sessionId, dedupeKey);

  try {
    await chrome.tabs.sendMessage(session.examTabId, {
      type: 'BROWSER_TAB_SWITCH',
      metadata: { ...metadata, isExamTab },
    });
  } catch {
    // The exam tab may have closed; its removal handler clears the session context.
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'SESSION_START') {
    if (!sender.tab?.id || !/^[a-f\d]{24}$/i.test(message.sessionId || '')) {
      sendResponse({ ok: false, error: 'Invalid exam session' });
      return false;
    }

    chrome.storage.session.set({
      [SESSION_KEY]: {
        sessionId: message.sessionId,
        examTabId: sender.tab.id,
      },
    }).then(() => {
      lastReportedBySession.delete(message.sessionId);
      sendResponse({ ok: true, connected: true });
      void reportActiveTab(sender.tab.id);
    }).catch(() => sendResponse({ ok: false, error: 'Unable to start tab monitoring' }));
    return true;
  }

  if (message?.type === 'SESSION_STOP') {
    readSession().then((session) => {
      if (session && session.examTabId === sender.tab?.id) {
        lastReportedBySession.delete(session.sessionId);
        return chrome.storage.session.remove(SESSION_KEY);
      }
      return undefined;
    }).then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false, error: 'Unable to stop tab monitoring' }));
    return true;
  }

  return false;
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void reportActiveTab(tabId);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  chrome.tabs.query({ active: true, windowId }).then((tabs) => {
    if (tabs[0]?.id) void reportActiveTab(tabs[0].id);
  }).catch((error) => {
    console.warn('[Overlay Proctor] Could not read the focused window tab:', error.message);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url && changeInfo.status !== 'complete') return;
  chrome.tabs.query({ active: true, lastFocusedWindow: true }).then((tabs) => {
    if (tabs[0]?.id === tabId) void reportActiveTab(tabId);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void readSession().then((session) => {
    if (session?.examTabId === tabId) {
      lastReportedBySession.delete(session.sessionId);
      return chrome.storage.session.remove(SESSION_KEY);
    }
    return undefined;
  });
});
