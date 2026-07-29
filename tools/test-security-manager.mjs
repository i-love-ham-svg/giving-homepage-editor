import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const managerPath = resolve("outputs", "editor-security-manager.js");
const source = readFileSync(managerPath, "utf8");
const context = { window: {} };

vm.createContext(context);
vm.runInContext(source, context, { filename: managerPath });

const manager = context.window.EditorSecurityManager;
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const safePng = "data:image/png;base64,iVBORw0KGgo=";
assert(manager.isSafeImageDataUrl(safePng), "PNG data URL should be accepted");
assert(!manager.isSafeImageDataUrl("data:image/svg+xml,<svg onload=alert(1)></svg>"), "SVG data URL should be rejected");
assert(!manager.isSafeImageDataUrl("javascript:alert(1)"), "script URL should be rejected");

assert(manager.validateImageFile({ type: "image/png", size: 100 }).ok, "valid image file should pass");
assert(!manager.validateImageFile({ type: "image/svg+xml", size: 100 }).ok, "SVG upload should fail");
assert(!manager.validateImageFile({ type: "image/png", size: 16 * 1024 * 1024 }).ok, "oversized upload should fail");
assert(manager.validateImageDimensions(4000, 3000).ok, "ordinary image dimensions should pass");
assert(!manager.validateImageDimensions(20_000, 20_000).ok, "extreme image dimensions should fail");

const sanitizedAsset = manager.sanitizeImageAsset({ dataUrl: "javascript:alert(1)", manualDataUrl: safePng, name: "safe.png" });
assert(sanitizedAsset.dataUrl === null, "unsafe stored image should be removed");
assert(sanitizedAsset.manualDataUrl === safePng, "safe stored image should be preserved");
assert(sanitizedAsset.name === "safe.png", "asset metadata should be preserved");

const defaultSeal = manager.sanitizeSealMarkup("<span>재단<br>인</span>");
assert(defaultSeal.type === "text" && defaultSeal.lines.join("/") === "재단/인", "legacy seal text should be preserved");
const imageSeal = manager.sanitizeSealMarkup(`<img src="${safePng}" onerror="alert(1)">`);
assert(imageSeal.type === "image" && imageSeal.src === safePng, "safe seal image should be extracted without attributes");
const maliciousSeal = manager.sanitizeSealMarkup("<img src=x onerror=window.hacked=true><script>alert(1)</script>");
assert(maliciousSeal.type === "text" && maliciousSeal.lines.join("/") === "재단/인", "malicious seal markup should fall back to safe text");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("security manager tests OK");
}
