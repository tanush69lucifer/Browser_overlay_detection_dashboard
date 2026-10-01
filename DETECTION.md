# Client detector: techniques and limits

The client reports integrity signals for server-side scoring and human review. A signal is not a conclusion that a candidate cheated. The detector reads page structure and browser focus state; it does not capture screenshots, HTML snapshots, webcam video, keystrokes, or pasted text.

| Technique | Implemented | How it works | What it catches | Limitations |
|---|---|---|---|---|
| Mutation observation | Yes | A `MutationObserver` queues added element nodes. A single two-second processing loop evaluates them. | Newly injected DOM nodes without doing work or network requests for every mutation. | Mutations that do not leave a visible or inspectable footprint are missed. |
| High z-index / fixed overlay scan | Yes | Scans top-level HTML/body children and queued elements; checks computed position, z-index, and viewport area. | Large fixed/absolute panels with z-index above 9999 and area of at least 5%. | Small, nested, restyled, hidden, or lower-z-index overlays can evade it; legitimate panels can match. |
| Known extension fingerprints | Yes, best-effort | Checks configured selectors and extension iframe URL prefixes, including optional server definitions. | Listed Grammarly, Sider, Monica selector patterns, demo, and extension URL signatures. | Fingerprints change; Monica selectors are heuristic and may match unrelated page elements; presence does not prove misuse. |
| Shadow DOM / foreign roots | Yes, partial | Detects open shadow roots on inspected elements. | Open shadow roots attached to top-level or queued elements. | Closed roots are not exposed; deeply nested roots may not be inspected. |
| Focus / blur & visibility | Yes | Listens for window blur and hidden document state. | Focus changes and tab backgrounding. | Ordinary app switching, notifications, and browser behavior can trigger these signals. Supporting evidence only. |
| DOM integrity / node count | Yes, partial | Baselines direct HTML and body child counts, then reports growth by two or more. | Some bulk additions to the top-level containers. | Page content naturally changes; counts do not identify the cause. |
| Extension-resource probing | Partial | Recognizes extension scheme URLs if they appear in iframe `src` or configured iframe-prefix fingerprints. | Visible `chrome-extension://` and `moz-extension://` iframe URLs. | Does not actively probe extension resources or enumerate installed extensions. Browser access and extension visibility are restricted. |
| DevTools / paste / shortcut signals | Partial | Uses a 160px outer/inner window gap heuristic and reports paste length only when it exceeds 100 characters. The next paste within five seconds of a copy initiated on this page is ignored. | Some DevTools layouts and large pastes not immediately preceded by a copy on the current page. | Gap heuristic is unreliable; no shortcuts are recorded because the supported specification defines no shortcut event. Clipboard access can be absent. A different external paste within five seconds of a page copy can be missed. |

## False-positive controls

- Elements under `[data-proctor]` are excluded from mutation queueing and detection.
- Overlay keys are deterministic from tag, z-index, and a short hash of id/class; the node is reported once while it remains the same node.
- Fingerprints are labeled and treated as best-effort evidence, not a verdict.
- Blur and hidden-tab events are low-severity supporting signals.
- A copy event on the current page suppresses the next paste for up to five seconds; only a timestamp is kept briefly, never the copied or pasted text.
- Signal buffers are bounded and batch transmission is used instead of per-mutation requests.

## Known limitations

The detector cannot reliably detect desktop overlay applications outside the page, a second physical device, extensions using closed shadow roots with no visible footprint, browser side panels outside the page, extensions that delay injection until after the exam, or extensions with no detectable in-page footprint. Browser behavior, user settings, and legitimate page UI can also produce false positives. Detection is best-effort and **does not guarantee 100% detection**.

Cluely is currently documented by its vendor as a desktop app. This page detector can report it only if it creates an inspectable footprint inside the exam page or causes a supporting focus signal; it cannot inspect a separate operating-system window. Sider, Grammarly, Monica, and any unknown tool are matched through best-effort page selectors, generic overlay shape checks, or additional configured fingerprints.

## Privacy

Signals contain codes, timestamps, bounded keys, and small integrity metadata such as tag, z-index, area percentage, tool, matcher, paste length, and focus state. The detector never sends HTML or pasted text and does not capture a screen, webcam, or keystrokes.
