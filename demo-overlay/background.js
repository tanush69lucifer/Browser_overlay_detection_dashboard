/**
 * Service Worker background script.
 * Listens for extension shortcut (Alt+O) or toolbar icon clicks,
 * sending toggle message to active content scripts.
 */

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-overlay') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle' });
      }
    });
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
  }
});
