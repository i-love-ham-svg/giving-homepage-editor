# Representative Greeting Editor Tools

## Local HTTP Server

Run the editor through `http://127.0.0.1` instead of `file://`.

```powershell
& 'C:\Users\i-lov\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools\serve-editor.mjs
```

Default URL:

```text
http://127.0.0.1:4185/representative-greeting-editor.html
```

Smoke check URL:

```text
http://127.0.0.1:4185/representative-greeting-editor.html?smoke=1
```

The smoke check runs `window.runEditorRegressionSmoke()` inside the page and writes the result to `window.__editorRegressionSmokeResult`.

## Storage Schema Test

Run the storage schema migration checks without opening the browser.

```powershell
& 'C:\Users\i-lov\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools\test-storage-schema.mjs
```

Run compact-save and storage byte-size checks.

```powershell
& 'C:\Users\i-lov\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools\test-storage-manager.mjs
```

## Section Manager Test

Run section order, label, and paste-compatibility checks.

```powershell
& 'C:\Users\i-lov\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools\test-section-manager.mjs
```

## Main Intro Manager Test

Run main-intro section id, layer id, label, and viewport-map checks.

```powershell
& 'C:\Users\i-lov\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools\test-main-intro-manager.mjs
```

## Greeting Manager Test

Run representative-greeting section id, layer id, label, and viewport-map checks.

```powershell
& 'C:\Users\i-lov\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools\test-greeting-manager.mjs
```

## Viewport Manager Test

Run PC, phone, tablet viewport normalization and map fallback checks.

```powershell
& 'C:\Users\i-lov\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools\test-viewport-manager.mjs
```

## Performance Manager Test

Run frame scheduling checks used by drag and layout updates.

```powershell
& 'C:\Users\i-lov\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools\test-performance-manager.mjs
```

## Full Stability Test

Run every local manager and storage regression test.

```powershell
& 'C:\Users\i-lov\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools\test-all.mjs
```
