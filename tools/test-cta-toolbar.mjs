import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../outputs/representative-greeting-editor.html", import.meta.url), "utf8");

assert.match(html, /\.view-mode\s+\.donation-cta-input\s*\{\s*display:\s*none\s*!important;\s*\}/);
assert.match(html, /\.edit-mode\s+\.donation-view-only\s*\{\s*display:\s*none\s*!important;\s*\}/);
assert.match(html, /\.donation-cta-input,\s*\.donation-view-only\s*\{[\s\S]*?width:\s*min\(100%,\s*420px\);[\s\S]*?min-height:\s*58px;[\s\S]*?margin-top:\s*18px;[\s\S]*?padding:\s*15px 34px;[\s\S]*?border-radius:\s*6px;[\s\S]*?background:\s*var\(--donation-cta-bg\);[\s\S]*?color:\s*var\(--donation-cta-text\)\s*!important;/);
assert.match(html, /\.stage\.mobile\s+\.donation-cta-input,\s*\.stage\.mobile\s+\.donation-view-only\s*\{\s*width:\s*100%;\s*\}/);
assert.match(html, /data-editor-toolbar="cta"/);
assert.match(html, /CTA 편집 막대 열기/);
assert.match(html, /· CTA 편집/);
assert.match(html, /function getSelectedCtaTarget\(\)/);
assert.match(html, /function syncCtaBackgroundControl\(\)/);

console.log("CTA toolbar tests OK");
