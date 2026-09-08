import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = resolve(__dirname, "..");
const outputRoot = resolve(
  process.env.SONGAK_EDITOR_ASSET_ROOT || resolve(workspaceRoot, "outputs"),
);
const defaultFile = "representative-greeting-editor.html";
const host = "127.0.0.1";
const requestedPort = Number.parseInt(process.env.PORT ?? process.argv.at(2) ?? "43185", 10);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
  ".hwp": "application/x-hwp",
  ".hwpx": "application/vnd.hancom.hwpx",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".zip": "application/zip",
  ".txt": "text/plain; charset=utf-8",
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
  const normalizedPath = pathname.replace(/^\/+/, "");
  // The production editor is mounted below /songak/ via its <base> element.
  // Mirror that mount locally so the exact deployment HTML can be reviewed
  // without rewriting asset URLs or silently booting with missing scripts.
  const mountedPath = normalizedPath === "songak"
    ? ""
    : normalizedPath.startsWith("songak/")
      ? normalizedPath.slice("songak/".length)
      : normalizedPath;
  const isCanonicalPublicRoute = mountedPath === ""
    || /^(?:about|programs|participation|news)(?:\/|$)/.test(mountedPath)
    || ["directions", "privacy-policy", "email-refusal"].includes(mountedPath);
  const requested = isCanonicalPublicRoute ? defaultFile : mountedPath;
  const resolved = resolve(outputRoot, requested);
  if (!isInside(outputRoot, resolved)) return null;
  if (existsSync(resolved) && statSync(resolved).isDirectory()) {
    return join(resolved, defaultFile);
  }
  return resolved;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  res.end(JSON.stringify(payload));
  return true;
}

// The static editor preview must never become a second application backend.
// Integrated board/application routes fail closed and point QA to delivery-site.
function handleRetiredIntegratedServiceRequest(res, parsedUrl) {
  const pathname = decodeURIComponent(parsedUrl.pathname).replace(/\/+$/, "") || "/";
  const retiredApplicationPath = pathname === "/api/applications"
    || pathname === "/songak/api/applications";
  if (retiredApplicationPath) {
    return sendJson(res, 410, {
      error: "정적 편집 서버에서는 온라인 신청 API를 제공하지 않습니다.",
      service: "delivery-site",
      canonicalPath: "/api/applications"
    });
  }
  const retiredPages = new Set([
    "/community",
    "/community-board",
    "/community-board.html",
    "/community-board.js",
    "/editor-board-manager.js",
    "/songak/community-board",
    "/songak/community-board.html",
    "/songak/community-board.js",
    "/songak/editor-board-manager.js"
  ]);
  const retiredServicePath = ["/api/board", "/board-media", "/songak/api/board", "/songak/board-media"]
    .some((base) => pathname === base || pathname.startsWith(`${base}/`));
  if (!retiredPages.has(pathname) && !retiredServicePath) return false;
  return sendJson(res, 410, {
    error: "정적 편집 서버에서는 소통게시판을 제공하지 않습니다.",
    service: "delivery-site",
    canonicalPath: "/community"
  });
}

function createEditorServer() {
  return createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url ?? "/", `http://${host}`);
      if (handleRetiredIntegratedServiceRequest(res, parsedUrl)) return;
      const filePath = resolveRequestPath(req.url ?? "/");
      if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      res.writeHead(200, {
        "content-type": mimeTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff"
      });
      createReadStream(filePath).pipe(res);
    } catch (error) {
      const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
      const status = /관리자|비밀번호/.test(message) ? 401 : /용량/.test(message) ? 413 : 400;
      sendJson(res, status, { error: message });
    }
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

const isDirectExecution = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  const { port } = await listenOnAvailablePort(Number.isFinite(requestedPort) ? requestedPort : 43185);
  console.log(`Representative greeting editor: http://${host}:${port}/${defaultFile}`);
  console.log(`Smoke check URL: http://${host}:${port}/${defaultFile}?smoke=1`);
  console.log("Community board QA: run delivery-site and use its canonical /community route");
  console.log("Application API QA: run delivery-site and use its canonical /api/applications route");
}

export { createEditorServer };
