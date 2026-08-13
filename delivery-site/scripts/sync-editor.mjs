import { readFileSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSource = path.resolve(appRoot, "..", "outputs");
const defaultDestination = path.join(appRoot, "public", "songak");
const defaultBuiltDestination = path.join(appRoot, "dist", "client", "songak");
const retiredArtifactRegistry = JSON.parse(readFileSync(
  new URL("../../docs/retired-artifacts.json", import.meta.url),
  "utf8",
));

export const EXCLUDED_EDITOR_FILES = Object.freeze([
  ...retiredArtifactRegistry.deploymentExclusions,
]);
export const EXCLUDED_LEGACY_BOARD_FILES = Object.freeze([
  ...retiredArtifactRegistry.groups
    .find((group) => group.id === "retired-community-board")
    .deliveryPaths,
]);

const excludedEditorFiles = new Set(EXCLUDED_EDITOR_FILES);

function toPortableRelativePath(sourceRoot, candidatePath) {
  return path.relative(sourceRoot, candidatePath).split(path.sep).join("/");
}

// Source archives remain in outputs for migration history. The reviewed manifest
// is the single delivery boundary that prevents retired renderers from shipping.
export async function syncEditorAssets({
  source = defaultSource,
  destination = defaultDestination,
  builtDestination = defaultBuiltDestination,
} = {}) {
  const sourceRoot = path.resolve(source);
  const publicRoot = path.resolve(destination);
  const builtRoot = path.resolve(builtDestination);

  await rm(publicRoot, { recursive: true, force: true });
  await mkdir(path.dirname(publicRoot), { recursive: true });
  await cp(sourceRoot, publicRoot, {
    recursive: true,
    filter(candidatePath) {
      const relativePath = toPortableRelativePath(sourceRoot, candidatePath);
      return !excludedEditorFiles.has(relativePath);
    },
  });

  await Promise.all(EXCLUDED_EDITOR_FILES.map((fileName) =>
    rm(path.join(builtRoot, fileName), { force: true })));

  return { source: sourceRoot, destination: publicRoot, builtDestination: builtRoot };
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  const result = await syncEditorAssets();
  console.log(`Synced Songak editor to ${result.destination}`);
}
