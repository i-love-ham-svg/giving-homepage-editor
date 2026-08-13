import { createHash } from "node:crypto";
import { access, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { EXCLUDED_LEGACY_BOARD_FILES } from "./sync-editor.mjs";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSource = path.resolve(appRoot, "..", "outputs");
const defaultPublicDestination = path.join(appRoot, "public", "songak");
const defaultBuiltDestination = path.join(appRoot, "dist", "client", "songak");
const defaultBuiltWranglerConfig = path.join(appRoot, "dist", "server", "wrangler.json");
const excluded = new Set(EXCLUDED_LEGACY_BOARD_FILES);

async function listFiles(root, relative = "") {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const next = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(root, next));
    else if (entry.isFile()) files.push(next);
  }
  return files;
}

async function digest(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function expectMissing(filePath) {
  try {
    await access(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Legacy board artifact must not be shipped: ${filePath}`);
}

/**
 * Verify the generated Worker config, not only the source Vite config. This
 * catches builds that silently drop the local ASSETS binding or route assets
 * ahead of the public Worker.
 */
export async function verifyBuiltWorkerAssetsConfig(wranglerConfig = defaultBuiltWranglerConfig) {
  const configPath = path.resolve(wranglerConfig);
  let config;
  try {
    config = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`Built Worker config is missing: ${configPath}`);
    if (error instanceof SyntaxError) throw new Error(`Built Worker config is not valid JSON: ${configPath}`);
    throw error;
  }

  const assets = config?.assets;
  if (!assets || typeof assets !== "object") {
    throw new Error(`Built Worker assets config is missing: ${configPath}`);
  }
  if (assets.binding !== "ASSETS") {
    throw new Error(`Built Worker assets binding must be ASSETS: ${configPath}`);
  }
  if (assets.run_worker_first !== true) {
    throw new Error(`Built Worker assets must set run_worker_first to true: ${configPath}`);
  }
  if (typeof assets.directory !== "string" || !assets.directory.trim()) {
    throw new Error(`Built Worker assets directory is missing: ${configPath}`);
  }
  if (assets.html_handling !== "none") {
    throw new Error(`Built Worker assets html_handling must be none: ${configPath}`);
  }

  return { configPath, assets };
}

/**
 * Fail a build when the checked-in editor, public copy, and built copy drift.
 * This prevents an old standalone board or a stale homepage renderer from
 * silently reappearing in a later deployment.
 */
export async function verifyEditorAssetParity({
  source = defaultSource,
  publicDestination = defaultPublicDestination,
  builtDestination = defaultBuiltDestination,
  builtWranglerConfig = defaultBuiltWranglerConfig,
} = {}) {
  const sourceRoot = path.resolve(source);
  const destinations = [path.resolve(publicDestination), path.resolve(builtDestination)];
  const sourceFiles = (await listFiles(sourceRoot)).filter((relative) => !excluded.has(relative));
  if (!sourceFiles.includes("representative-greeting-editor.html")) {
    throw new Error("Canonical Songak editor HTML is missing from outputs.");
  }

  const sourceHashes = new Map(await Promise.all(sourceFiles.map(async (relative) => [
    relative,
    await digest(path.join(sourceRoot, ...relative.split("/"))),
  ])));

  for (const destination of destinations) {
    for (const legacyFile of EXCLUDED_LEGACY_BOARD_FILES) {
      await expectMissing(path.join(destination, legacyFile));
    }
    for (const relative of sourceFiles) {
      const target = path.join(destination, ...relative.split("/"));
      let targetHash;
      try {
        targetHash = await digest(target);
      } catch (error) {
        if (error?.code === "ENOENT") throw new Error(`Built editor asset is missing: ${target}`);
        throw error;
      }
      if (targetHash !== sourceHashes.get(relative)) {
        throw new Error(`Built editor asset differs from outputs: ${target}`);
      }
    }
  }

  const workerAssets = await verifyBuiltWorkerAssetsConfig(builtWranglerConfig);
  return { fileCount: sourceFiles.length, destinations, workerAssets };
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  const result = await verifyEditorAssetParity();
  console.log(`Verified ${result.fileCount} Songak editor assets and Worker-first ASSETS binding in build output.`);
}
