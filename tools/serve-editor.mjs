import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BoardStore } from "./board-store.mjs";
import { ApplicationStore } from "./application-store.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = resolve(__dirname, "..");
const outputRoot = resolve(workspaceRoot, "outputs");
const defaultFile = "representative-greeting-editor.html";
const host = "127.0.0.1";
const requestedPort = Number.parseInt(process.env.PORT ?? process.argv.at(2) ?? "43185", 10);
const boardStore = new BoardStore({
  dataDir: process.env.BOARD_DATA_DIR ? resolve(process.env.BOARD_DATA_DIR) : resolve(workspaceRoot, "data", "board"),
  adminKey: process.env.BOARD_ADMIN_PASSWORD ?? "songak-local-admin"
});
const adminPassword = process.env.BOARD_ADMIN_PASSWORD ?? "songak-local-admin";
const applicationStore = new ApplicationStore({
  dataDir: process.env.APPLICATION_DATA_DIR ? resolve(process.env.APPLICATION_DATA_DIR) : resolve(workspaceRoot, "data", "applications")
});
const visitorPostAttempts = new Map();

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
  const requested = pathname === "/" ? defaultFile : pathname.replace(/^\/+/, "");
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

function readRequestBody(req, maxBytes) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on("data", (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > maxBytes) {
        tooLarge = true;
        rejectBody(new Error("업로드 용량 제한을 초과했습니다."));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => { if (!tooLarge) resolveBody(Buffer.concat(chunks)); });
    req.on("error", rejectBody);
  });
}

async function readJson(req) {
  const buffer = await readRequestBody(req, 1024 * 1024);
  if (!buffer.length) return {};
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new Error("요청 내용을 확인할 수 없습니다.");
  }
}

function getAdminKey(req) {
  return String(req.headers["x-board-admin-key"] ?? "");
}

function canCreateVisitorPost(req) {
  const ip = String(req.socket.remoteAddress ?? "local");
  const now = Date.now();
  const windowStart = now - 10 * 60 * 1000;
  const recent = (visitorPostAttempts.get(ip) ?? []).filter((time) => time > windowStart);
  if (recent.length >= 5) return false;
  recent.push(now);
  visitorPostAttempts.set(ip, recent);
  return true;
}

async function handleBoardRequest(req, res, parsedUrl) {
  const pathname = decodeURIComponent(parsedUrl.pathname);
  const adminKey = getAdminKey(req);

  if (pathname.startsWith("/board-media/") && req.method === "GET") {
    const media = boardStore.resolveMedia(pathname.slice("/board-media/".length));
    if (!media) return sendJson(res, 404, { error: "파일을 찾을 수 없습니다." });
    const downloadExtensions = new Set([".pdf", ".hwp", ".hwpx", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip", ".txt"]);
    const headers = {
      "content-type": mimeTypes[media.extension] ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff"
    };
    if (downloadExtensions.has(media.extension)) headers["content-disposition"] = `attachment; filename="${encodeURIComponent(pathname.split("/").at(-1) || "attachment")}"`;
    res.writeHead(200, headers);
    createReadStream(media.filePath).pipe(res);
    return true;
  }

  if (pathname === "/api/board/media" && req.method === "POST") {
    const type = String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
    const maxBytes = type.startsWith("video/") ? 100 * 1024 * 1024 : type.startsWith("image/") ? 15 * 1024 * 1024 : 30 * 1024 * 1024;
    const buffer = await readRequestBody(req, maxBytes);
    let name = "media";
    try { name = decodeURIComponent(String(req.headers["x-file-name"] ?? "media")); } catch {}
    return sendJson(res, 201, { item: boardStore.saveMedia(buffer, { type, name }) });
  }

  if (pathname === "/api/board/posts" && req.method === "GET") {
    const query = Object.fromEntries(parsedUrl.searchParams.entries());
    return sendJson(res, 200, boardStore.list(query, adminKey));
  }

  if (pathname === "/api/board/posts" && req.method === "POST") {
    if (!adminKey && !canCreateVisitorPost(req)) return sendJson(res, 429, { error: "잠시 후 다시 작성해 주세요." });
    const input = await readJson(req);
    return sendJson(res, 201, { item: boardStore.create(input, adminKey) });
  }

  const match = pathname.match(/^\/api\/board\/posts\/([^/]+)(?:\/(moderate|report))?$/);
  if (!match) return false;
  const id = match[1];
  const action = match[2] ?? "";

  if (req.method === "GET" && !action) {
    const item = boardStore.get(id, adminKey, parsedUrl.searchParams.get("view") === "1");
    return item ? sendJson(res, 200, { item }) : sendJson(res, 404, { error: "게시글을 찾을 수 없습니다." });
  }
  if (req.method === "PATCH" && !action) {
    const input = await readJson(req);
    const item = boardStore.update(id, input, { adminKey, password: input.password });
    return item ? sendJson(res, 200, { item }) : sendJson(res, 404, { error: "게시글을 찾을 수 없습니다." });
  }
  if (req.method === "DELETE" && !action) {
    const input = await readJson(req);
    const removed = boardStore.remove(id, { adminKey, password: input.password });
    return removed ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: "게시글을 찾을 수 없습니다." });
  }
  if (req.method === "POST" && action === "moderate") {
    const input = await readJson(req);
    const item = boardStore.moderate(id, input.status, adminKey);
    return item ? sendJson(res, 200, { item }) : sendJson(res, 404, { error: "게시글을 찾을 수 없습니다." });
  }
  if (req.method === "POST" && action === "report") {
    const result = boardStore.report(id);
    return result ? sendJson(res, 200, result) : sendJson(res, 404, { error: "게시글을 찾을 수 없습니다." });
  }
  return false;
}

async function handleApplicationRequest(req, res, parsedUrl) {
  const pathname = decodeURIComponent(parsedUrl.pathname);
  if (pathname !== "/api/applications") return false;
  if (req.method === "POST") {
    const input = await readJson(req);
    const item = applicationStore.create(input);
    return sendJson(res, 201, { receipt: item.receipt, status: item.status });
  }
  if (req.method === "GET") {
    const items = applicationStore.list(getAdminKey(req), adminPassword);
    return sendJson(res, 200, { items, total: items.length });
  }
  return sendJson(res, 405, { error: "지원하지 않는 요청 방식입니다." });
}

function createEditorServer() {
  return createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url ?? "/", `http://${host}`);
      if (await handleApplicationRequest(req, res, parsedUrl)) return;
      if (await handleBoardRequest(req, res, parsedUrl)) return;
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

const { port } = await listenOnAvailablePort(Number.isFinite(requestedPort) ? requestedPort : 43185);
console.log(`Representative greeting editor: http://${host}:${port}/${defaultFile}`);
console.log(`Smoke check URL: http://${host}:${port}/${defaultFile}?smoke=1`);
console.log(`Community board: http://${host}:${port}/community-board.html`);
