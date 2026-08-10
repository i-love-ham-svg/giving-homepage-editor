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

Run every local manager and storage regression test.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\test-all.mjs
```

## Responsive visual tests

Run the SNS login image/layout/toolbar test and the semantic section appearance test.

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\test-sns-auth-browser.mjs
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\test-section-appearance-browser.mjs
```
