let observer = null;

function isExcluded(node) {
  if (!(node instanceof Element)) return true;
  try {
    return Boolean(node.closest('[data-proctor]'));
  } catch {
    return true;
  }
}

export function start(queue) {
  if (observer || !document.documentElement || typeof queue !== 'function') return stop;

  observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element && !isExcluded(node)) queue(node);
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  return stop;
}

export function stop() {
  observer?.disconnect();
  observer = null;
}
