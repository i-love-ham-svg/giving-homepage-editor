import { spawn } from "node:child_process";
import { request } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const serverFile = resolve(workspaceRoot, "tools", "serve-editor.mjs");
const port = Number.parseInt(process.argv.at(2) ?? "43185", 10);
const editorUrl = `http://127.0.0.1:${port}/representative-greeting-editor.html`;

function isEditorReady(timeoutMs = 700) {
  return new Promise((resolveReady) => {
    const req = request(editorUrl, { method: "HEAD" }, (res) => {
      res.resume();
      resolveReady((res.statusCode ?? 500) < 500);
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolveReady(false);
    });
    req.on("error", () => resolveReady(false));
    req.end();
  });
}

if (!(await isEditorReady())) {
  const server = spawn(process.execPath, [serverFile, String(port)], {
    cwd: workspaceRoot,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  server.unref();

  let ready = false;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
    if (await isEditorReady()) {
      ready = true;
      break;
    }
  }

  if (!ready) {
    console.error("Editor server did not become ready.");
    process.exit(1);
  }
}
