import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = resolve(__dirname, "..");
const outputRoot = resolve(workspaceRoot, "outputs");
const defaultFile = "representative-greeting-editor.html";
const host = "127.0.0.1";
const requestedPort = Number.parseInt(process.env.PORT ?? process.argv.at(2) ?? "4185", 10);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function isInside(parent, child) {
  const delta = relative(parent, child);
  return delta === "" || (!delta.startsWith("..") && !isAbsolute(delta));
}

function resolveRequestPath(url) {
  const parsed = new URL(url, `http://${host}`);
  const pathname = decodeURIComponent(parsed.pathname);
  const requested = pathname === "/" ? defaultFile : pathname.replace(/^\/+/, "");
  const resolved = resolve(outputRoot, requested);
  if (!isInside(outputRoot, resolved)) return null;
  if (existsSync(resolved) && statSync(resolved).isDirectory()) {
    return join(resolved, defaultFile);
  }
  return resolved;
}

function createEditorServer() {
  return createServer((req, res) => {
    const filePath = resolveRequestPath(req.url ?? "/");
    if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "content-type": mimeTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store"
    });
    createReadStream(filePath).pipe(res);
  });
}

async function listenOnAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    const server = createEditorServer();
    try {
      await new Promise((resolveListen, rejectListen) => {
        server.once("error", rejectListen);
        server.listen(port, host, resolveListen);
      });
      return { server, port };
    } catch (error) {
      server.close();
      if (error.code !== "EADDRINUSE") throw error;
    }
  }
  throw new Error(`No available port from ${startPort} to ${startPort + 19}`);
}

const { port } = await listenOnAvailablePort(Number.isFinite(requestedPort) ? requestedPort : 4185);
console.log(`Representative greeting editor: http://${host}:${port}/${defaultFile}`);
console.log(`Smoke check URL: http://${host}:${port}/${defaultFile}?smoke=1`);
