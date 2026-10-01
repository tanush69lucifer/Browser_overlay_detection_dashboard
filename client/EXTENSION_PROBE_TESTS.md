# Extension resource probe test cases

The probe is an opt-in, configured check for one web-accessible image. It runs
once at exam detector startup for active `EXTENSION_RESOURCE` fingerprints.
Only `DETECTED` creates the `EXTENSION_RESOURCE_PROBE` signal.

| Case | Setup | Expected result | Proctor signal |
| --- | --- | --- | --- |
| Installed demo resource | Load `demo-overlay`, copy its ID, use `probe.svg` | `DETECTED` | MED `EXTENSION_RESOURCE_PROBE` |
| Missing resource | Installed demo ID, use `missing.svg` | `NOT_OBSERVED` | None |
| Uninstalled extension | Valid-format ID not installed, use `probe.svg` | `NOT_OBSERVED` or `TIMEOUT` | None |
| Invalid ID | Use `not-an-extension` | `INVALID_INPUT` with format reason | None |
| Unsafe path | Use `../manifest.json` | `INVALID_INPUT` | None |
| Browser blocks extension URL | Valid ID/path, block request or use unsupported browser | `NOT_OBSERVED` or `TIMEOUT` | None |
| Allowed configured resource | Mark configured fingerprint as allowed and expose image | `DETECTED` | LOW, weight 1 |
| Inactive fingerprint | Set `isActive: false` | No request | None |

## Manual run

1. From `demo-overlay`, load the unpacked extension in Chrome/Edge. Reload it
   after manifest changes and copy the ID from `chrome://extensions`.
2. Open `client/detector-test.html` through the running Vite server.
3. Enter the ID and `probe.svg`, then press **Probe configured resource**.
4. Confirm the status text and signal row. Try the missing-resource and invalid
   ID cases above; neither should add a signal.
5. For the production path, create an Admin fingerprint with matcher type
   `EXTENSION_RESOURCE`, matcher set to the extension ID, and resource path
   `probe.svg`; make sure that fingerprint is included in the candidate exam.

## Reporting limits

`DETECTED` means only that the configured extension-owned resource loaded. It
does not identify the extension's UI, inspect its scripts, or establish intent.
`NOT_OBSERVED`, `TIMEOUT`, and `ERROR` do not prove absence: extensions can keep
resources private, browsers can block cross-origin extension loads, and a
network or policy can prevent the request. This currently supports Chrome/Edge
IDs. The probe avoids arbitrary network URLs and only accepts relative SVG,
PNG, or WebP paths.
