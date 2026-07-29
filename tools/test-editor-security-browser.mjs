import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const editorUrl = pathToFileURL(resolve("outputs", "representative-greeting-editor.html")).href;
const browserCandidates = [
  process.env.BROWSER_EXECUTABLE,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);
const executablePath = browserCandidates.find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const issues = [];

try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on("pageerror", (error) => issues.push(`page error: ${error.message}`));
  await page.goto(`${editorUrl}?mode=edit`, { waitUntil: "commit" });
  await page.waitForSelector(".body-text", { state: "attached" });
  await page.waitForTimeout(200);

  const result = await page.evaluate(async () => {
    window.__storedSealExecuted = false;
    window.__legacyRoleExecuted = false;
    setGreetingSectionContent("greeting", {
      sealHtml: '<img src="x" onerror="window.__storedSealExecuted=true"><script>window.__storedSealExecuted=true</script>',
      assets: {
        seal: { name: "unsafe.svg", dataUrl: "data:image/svg+xml,<svg onload=alert(1)></svg>" },
        signature: { name: "unsafe.svg", dataUrl: "data:image/svg+xml,<svg onload=alert(1)></svg>" }
      },
      signature: { mode: "image", text: "안전 서명", language: "ko", style: "kr-brush" }
    });
    setProgramSectionContent("program", {
      ...getProgramSectionContent("program"),
      cards: getProgramSectionContent("program").cards.map((card, index) => index === 0
        ? { ...card, image: { name: "unsafe.svg", dataUrl: "data:image/svg+xml,<svg onload=alert(1)></svg>" } }
        : card)
    });
    applyLegacyIdentityContent("단체", '<img src="x" onerror="window.__legacyRoleExecuted=true">직함 <strong>성명</strong>');
    await new Promise((resolveFrame) => requestAnimationFrame(resolveFrame));
    return {
      executed: window.__storedSealExecuted,
      legacyRoleExecuted: window.__legacyRoleExecuted,
      sealImageCount: document.querySelectorAll("#sealLayer img").length,
      sealText: document.getElementById("sealLayer")?.textContent?.trim(),
      signatureImageCount: document.querySelectorAll("#signatureLayer img").length,
      programUnsafeImageCount: [...document.querySelectorAll(".program-card-image img")]
        .filter((image) => image.src.includes("svg+xml") || image.src.startsWith("javascript:"))
        .length
    };
  });

  if (result.executed) issues.push("stored seal markup executed script");
  if (result.legacyRoleExecuted) issues.push("legacy identity markup executed script");
  if (result.sealImageCount) issues.push("unsafe seal image was rendered");
  if (!result.sealText.includes("재단")) issues.push("unsafe seal did not fall back to safe text");
  if (result.signatureImageCount) issues.push("unsafe signature image was rendered");
  if (result.programUnsafeImageCount) issues.push("unsafe program image was rendered");
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}

if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log("editor security browser tests OK");
}
