# Representative Greeting Editor Tools

## Local HTTP Server

Run the editor by double-clicking `open-editor.cmd`. The editor must be served through `http://127.0.0.1` instead of `file://`.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\serve-editor.mjs
```

Default URL:

```text
http://127.0.0.1:43185/representative-greeting-editor.html
```

Smoke check URL:

```text
http://127.0.0.1:43185/representative-greeting-editor.html?smoke=1
```

The smoke check runs `window.runEditorRegressionSmoke()` inside the page and writes the result to `window.__editorRegressionSmokeResult`.

## Integrated Community Board and Application QA

The static editor server does not host a board, application API, board API, or board media. Its `/community`, retired board-file, `/api/board/*`, `/board-media/*`, and `/api/applications` routes intentionally return HTTP 410 so they cannot become fallback applications.

Run board QA only from the integrated site:

```powershell
Set-Location delivery-site
pnpm dev
```

Open the exact local URL printed by that server and append `/community`. Application POST/authorized GET QA uses `/api/applications` on the same integrated server.

`docs/retired-artifacts.json` is the canonical quarantine manifest. It keeps retired source files recoverable for migration history while excluding reviewed filenames from generated public/build copies. The manifest also distinguishes active redirect wrappers and generated image originals that must remain available until deployed D1 content can be audited.

`tools/test-board-manager.mjs`, `tools/test-board-store.mjs`, `tools/board-store.mjs`, and `tools/application-store.mjs` are archival standalone fixtures and are intentionally excluded from `tools/test-all.mjs`. They remain in source control for migration history and are never a delivery acceptance gate. Do not delete them or the corresponding retired `outputs/community-board.*` and `outputs/editor-board-manager.js` files as part of routine cleanup.

## Storage Schema Test

Run the storage schema migration checks without opening the browser.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\test-storage-schema.mjs
```

Run compact-save and storage byte-size checks.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\test-storage-manager.mjs
```

## Section Manager Test

Run section order, label, and paste-compatibility checks.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\test-section-manager.mjs
```

## Main Intro Manager Test

Run main-intro section id, layer id, label, and viewport-map checks.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\test-main-intro-manager.mjs
```

## Greeting Manager Test

Run representative-greeting section id, layer id, label, and viewport-map checks.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\test-greeting-manager.mjs
```

## Viewport Manager Test

Run PC, phone, tablet viewport normalization and map fallback checks.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\test-viewport-manager.mjs
```

## Performance Manager Test

Run frame scheduling checks used by drag and layout updates.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\test-performance-manager.mjs
```

Run the real-browser DOM budget, route mount/unmount, and authentication-dialog preservation checks.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\test-lazy-section-mounting-browser.mjs
```

## Full Stability Test

Run every supported editor regression test plus the canonical integrated-board routing test.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\test-all.mjs
```

## Responsive visual tests

Run the SNS login image/layout/toolbar test and the semantic section appearance test.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\test-sns-auth-browser.mjs
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\test-section-appearance-browser.mjs
```

Run the mobile menu tests after changing public navigation, touch scrolling, or responsive menu layout. The repeated-navigation test covers selecting a page, inspecting it below the fold, reopening and closing the menu without losing position, and selecting a second page.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\test-mobile-menu-regression-browser.mjs
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\test-mobile-menu-repeat-navigation-browser.mjs
```
