(() => {
  'use strict';

  const OVERLAY_ID = 'ai-overlay-demo';
  let timer;

  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;

    const host = document.createElement('div');
    host.id = OVERLAY_ID;
    Object.assign(host.style, {
      position: 'fixed',
      zIndex: '2147483647',
      top: '0',
      right: '0',
      width: '360px',
      height: '100vh',
      maxWidth: '100vw',
      color: '#e2e8f0',
      background: '#111827',
      boxShadow: '0 0 24px rgba(0,0,0,.45)',
      font: '14px/1.5 system-ui, sans-serif'
    });

    const shadow = host.attachShadow({ mode: 'open' });
    const panel = document.createElement('section');
    Object.assign(panel.style, { boxSizing: 'border-box', height: '100%', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' });
    panel.innerHTML = '<header style="font-weight:700;font-size:18px">AI Study Assistant <button type="button" aria-label="Close" style="float:right">×</button></header><div style="padding:12px;border-radius:8px;background:#1f2937">Ask a question about this page</div><div style="padding:12px;border-radius:8px;background:#172554">Here is a generated explanation for your question. This demo content is synthetic.</div><div style="margin-top:auto;color:#94a3b8">Demo overlay for detector testing</div>';
    panel.querySelector('button').addEventListener('click', removeOverlay);

    const frame = document.createElement('iframe');
    frame.title = 'Demo assistant frame';
    frame.src = 'about:blank';
    frame.style.cssText = 'width:1px;height:1px;border:0;position:absolute;left:-10000px';
    panel.append(frame);
    shadow.append(panel);
    document.documentElement.append(host);
  }

  function removeOverlay() {
    document.getElementById(OVERLAY_ID)?.remove();
  }

  function toggleOverlay() {
    if (document.getElementById(OVERLAY_ID)) removeOverlay();
    else createOverlay();
  }

  function scheduleOverlay() {
    clearTimeout(timer);
    timer = setTimeout(createOverlay, 3000);
  }

  window.addEventListener('keydown', event => {
    if (event.altKey && event.key.toLowerCase() === 'o') {
      event.preventDefault();
      toggleOverlay();
    }
  });

  if (document.readyState === 'complete') scheduleOverlay();
  else window.addEventListener('load', scheduleOverlay, { once: true });
})();
