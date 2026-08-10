import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tests = [
  "tools/test-html-syntax.mjs",
  "tools/test-security-manager.mjs",
  "tools/test-category-toolbar-manager.mjs",
  "tools/test-home-menu-open-state.mjs",
  "tools/test-color-picker-manager.mjs",
  "tools/test-inline-text-toolbar.mjs",
  "tools/test-cta-toolbar.mjs",
  "tools/test-visual-asset-manager.mjs",
  "tools/test-sticker-library.mjs",
  "tools/test-history-manager.mjs",
  "tools/test-storage-schema.mjs",
  "tools/test-storage-manager.mjs",
  "tools/test-section-manager.mjs",
  "tools/test-staff-section-manager.mjs",
  "tools/test-main-intro-manager.mjs",
  "tools/test-program-manager.mjs",
  "tools/test-process-manager.mjs",
  "tools/test-timeline-manager.mjs",
  "tools/test-donation-manager.mjs",
  "tools/test-gallery-manager.mjs",
  "tools/test-essential-manager.mjs",
  "tools/test-footer-layouts.mjs",
  "tools/test-facility-detail-sections.mjs",
  "tools/test-detail-page-bundles.mjs",
  "tools/test-essential-notice-detail.mjs",
  "tools/test-greeting-manager.mjs",
  "tools/test-viewport-manager.mjs",
  "tools/test-performance-manager.mjs",
  "tools/test-board-manager.mjs",
  "tools/test-board-store.mjs",
  "tools/test-community-board-page.mjs",
  "tools/test-detail-pages.mjs"
];

const failures = [];

for (const test of tests) {
  const result = spawnSync(process.execPath, [test], {
    cwd: root,
    encoding: "utf8"
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) failures.push(test);
}

if (failures.length) {
  console.error(`Failed tests:\n${failures.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("all editor tests OK");
}
