/**
 * Demo Overlay Content Script
 * Injects a floating AI Assistant overlay simulating unauthorized helper tools (Sider, Monica, Copilot).
 * Toggled via Alt+O keyboard shortcut or extension icon.
 */

let overlayElement = null;

function createOverlay() {
  const container = document.createElement('div');
  container.id = 'proctor-demo-overlay';
  container.className = 'proctor-demo-overlay-active';

  container.innerHTML = `
    <div class="demo-overlay-header">
      <div class="demo-overlay-title">
        <span class="demo-ai-dot"></span>
        <span>AI Copilot Overlay Helper (Unauthorized)</span>
      </div>
      <button class="demo-overlay-close" id="demo-overlay-close-btn">&times;</button>
    </div>
    <div class="demo-overlay-body">
      <p class="demo-overlay-tag">Active Injection: High Z-Index Layer (Alt+O)</p>
      <div class="demo-prompt-box">
        <input type="text" placeholder="Ask question / paste exam text..." class="demo-input" />
        <button class="demo-btn">Solve</button>
      </div>
      <div class="demo-response-box">
        <strong>Suggested Solution:</strong>
        <p>This overlay simulates always-on-top transparent assistive software for testing detector telemetry.</p>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  // Close button listener
  document.getElementById('demo-overlay-close-btn').addEventListener('click', toggleOverlay);

  // Make draggable
  const header = container.querySelector('.demo-overlay-header');
  let isDragging = false;
  let offsetX = 0, offsetY = 0;

  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - container.offsetLeft;
    offsetY = e.clientY - container.offsetTop;
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      container.style.left = `${e.clientX - offsetX}px`;
      container.style.top = `${e.clientY - offsetY}px`;
      container.style.right = 'auto';
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  return container;
}

function toggleOverlay() {
  if (overlayElement) {
    overlayElement.remove();
    overlayElement = null;
    console.log('[Demo Overlay] Deactivated.');
  } else {
    overlayElement = createOverlay();
    console.log('[Demo Overlay] Injected with z-index 2147483647.');
  }
}

// In-page keyboard shortcut fallback: Alt+O
window.addEventListener('keydown', (e) => {
  if (e.altKey && (e.key === 'o' || e.key === 'O')) {
    e.preventDefault();
    toggleOverlay();
  }
});

// Message listener from extension background worker
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'toggle') {
      toggleOverlay();
    }
  });
}
