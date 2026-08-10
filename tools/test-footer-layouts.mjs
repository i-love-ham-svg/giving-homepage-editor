import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../outputs/representative-greeting-editor.html", import.meta.url), "utf8");

for (const [value, label] of [["info", "정보형"], ["simple", "심플형"], ["compact", "압축형"], ["split", "2단형"]]) {
  assert.match(html, new RegExp(`data-essential-layout-value="${value}"[^>]*>${label}<`));
}
for (const value of ["simple", "compact", "split"]) assert.match(html, new RegExp(`data-essential-layout="${value}"`));
assert.match(html, /<strong>푸터 스타일<\/strong>/);
assert.match(html, /\.stage\.edit-mode \.essential-footer-layout-switcher \{[\s\S]*?display: inline-flex !important;/);
assert.match(html, /\.essential-footer-layout-switcher strong \{[\s\S]*?color: #294b3c;/);
assert.match(html, /\["info", "simple", "compact", "split"\]\.includes\(requestedFooterLayout\)/);
assert.match(html, /data-essential-layout="compact"\][\s\S]*?grid-template-columns: repeat\(var\(--footer-contact-columns, 2\), minmax\(0, 1fr\)\)/);
assert.match(html, /data-essential-layout="split"\][\s\S]*?grid-template-areas:/);
assert.match(html, /"head details"\s*"foot links"/);
assert.match(html, /data-essential-template="footer"\] \{[\s\S]*?height: 100%;/);
assert.match(html, /data-essential-layout="split"\] \{[\s\S]*?padding: 42px clamp\(28px, 4\.5vw, 68px\) 14px;/);
assert.match(html, /\.stage\.view-mode \.essential-section-content\[data-essential-template="footer"\]\[data-essential-layout="split"\] \{\s*padding-top: 42px;/);
assert.match(html, /data-essential-layout="split"\] \.essential-item-grid \{[\s\S]*?grid-area: links;/);
assert.match(html, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(html, /function getEssentialMinimumHeightPx\(viewport, model\)[\s\S]*?model\?\.template === "footer"[\s\S]*?model\.layoutStyle === "split"[\s\S]*?return 220;[\s\S]*?return 250;[\s\S]*?return 310;/);
assert.match(html, /const minimum = getEssentialMinimumHeightPx\(key, model\);/);
assert.match(html, /getMinimumHeight: getEssentialMinimumHeightPx/);
assert.match(html, /\.stage\.mobile \.essential-footer-layout-switcher[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/);
assert.match(html, /id="footerDocumentModal"[\s\S]*?id="footerDocumentSaveBtn"/);
assert.match(html, /data-essential-action="open-footer-document"/);
assert.match(html, /class="footer-document-title-link"[\s\S]*?data-essential-action="open-footer-document"/);
assert.match(html, /\.stage\.view-mode \.footer-document-action \{ display: none !important; \}/);
assert.match(html, /\.stage\.view-mode \.essential-section-content\[data-essential-template="footer"\] \.footer-document-title-link \{[\s\S]*?display: inline-flex;/);
assert.match(html, /function openFooterDocumentModal\(/);
assert.match(html, /function saveFooterDocumentModal\(/);
assert.match(html, /본문·담당 정보 모달 편집/);
assert.match(html, /aria-label="\$\{escapeHtml\(item\.title\)\} 본문 내용 편집">본문 편집<\/button>/);
assert.match(html, /const itemContent = template === "footer"[\s\S]*?문서 제목 입력[\s\S]*?: `[\s\S]*?essential-item-badge/);
assert.match(html, /model\.template === "footer" \? "" : `<textarea class="essential-field essential-cta/);
assert.match(html, /id="inlineFooterScaleControl"/);
assert.match(html, /id="inlineFooterScaleRange"[^>]*min="80" max="130"/);
assert.match(html, /--footer-contact-columns:\$\{clamp/);
assert.match(html, /--footer-scale:\$\{clamp/);
assert.match(html, /const footerScale = model\.template === "footer"/);
assert.match(html, /style\.setProperty\("font-size", `\$\{scaledSize\}px`, model\.template === "footer" \? "important" : ""\)/);
assert.match(html, /published footer title[\s\S]*?footer-document-title-link[\s\S]*?applyFieldStyle/);
assert.match(html, /const useAutomaticMobileFooterSize = model\.template === "footer"[\s\S]*?field === "title"[\s\S]*?!item\.textStyleOverrides\?\.\[viewport\]\?\.\[field\]/);
assert.match(html, /useAutomaticMobileFooterSize[\s\S]*?\{ \.\.\.style, size: 10 \}/);
assert.match(html, /target\.textStyleOverrides\[viewport\]\[essentialField\.field\] = true/);

console.log("footer layout tests OK");
