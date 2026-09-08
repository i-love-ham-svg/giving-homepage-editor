import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tests = [
  "tools/test-background-float-bounds.mjs",
  "tools/test-theme-preset-labels-browser.mjs",
  "tools/test-change-registry.mjs",
  "tools/test-html-syntax.mjs",
  "tools/test-public-scope-loading.mjs",
  // Cold HTTP sessions must finish within the public boot budget. The fallback
  // gate also prevents a scoped publication error from shrinking the site.
  "tools/test-public-cold-load-browser.mjs",
  "tools/test-security-manager.mjs",
  "tools/test-category-toolbar-manager.mjs",
  "tools/test-home-menu-open-state.mjs",
  "tools/test-color-picker-manager.mjs",
  "tools/test-editor-modal-contract.mjs",
  "tools/test-editor-modal-contract-browser.mjs",
  "tools/test-inline-text-toolbar.mjs",
  "tools/test-cta-toolbar.mjs",
  "tools/test-visual-asset-manager.mjs",
  "tools/test-sticker-library.mjs",
  "tools/test-history-manager.mjs",
  "tools/test-storage-schema.mjs",
  "tools/test-storage-manager.mjs",
  "tools/test-section-manager.mjs",
  "tools/test-staff-section-manager.mjs",
  // Fixed staff controls share one measured bottom inset; exercise the open,
  // collapsed and dragged toolbar plus background and decoration UI at all profiles.
  "tools/test-staff-floating-ui-inset-browser.mjs",
  "tools/test-main-intro-manager.mjs",
  // Run the canonical CTA flow against a self-contained HTTP fixture so the
  // /songak/ base path, public routing, tab order and four viewports are real.
  "tools/test-main-intro-cta-browser.mjs",
  "tools/test-program-manager.mjs",
  // Public catalogue keeps all cards while deferring only off-screen paint.
  "tools/test-program-public-first-render-browser.mjs",
  "tools/test-process-manager.mjs",
  "tools/test-timeline-manager.mjs",
  "tools/test-donation-manager.mjs",
  // Validate the public donation CTA on its canonical HTTP route at all four
  // viewport profiles; the old file:// edit fixture cannot mount lazy routes.
  "tools/test-donation-cta-consistency-browser.mjs",
  "tools/test-gallery-manager.mjs",
  "tools/test-essential-manager.mjs",
  "tools/test-footer-layouts.mjs",
  "tools/test-facility-detail-sections.mjs",
  "tools/test-detail-page-bundles.mjs",
  "tools/test-essential-notice-detail.mjs",
  "tools/test-greeting-manager.mjs",
  "tools/test-viewport-manager.mjs",
  "tools/test-performance-manager.mjs",
  // The retired standalone board manager/file store are archival fixtures,
  // not acceptance criteria. Canonical board QA runs against delivery-site.
  "tools/test-community-board-page.mjs",
  "tools/test-detail-pages.mjs",
  "tools/test-desktop-menu-active-contrast-browser.mjs",
  // Exercise the real route state through open, close, reopen, reload and
  // history traversal so a pale generic submenu style cannot mask the leaf.
  "tools/test-public-selected-dropdown-browser.mjs"
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
