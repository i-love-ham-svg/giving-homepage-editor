"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const editorPath = path.resolve(__dirname, "..", "outputs", "representative-greeting-editor.html");
const source = fs.readFileSync(editorPath, "utf8");
const start = source.indexOf("    function chooseProtectedToolbarTop(");
const end = source.indexOf("\n\n    let inlineToolbarExpandedAt", start);
assert.ok(start >= 0 && end > start, "toolbar protected-placement helper must be extractable");
const helperSource = source.slice(start, end);
const context = {
  clamp: (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value)),
  rectsOverlap: (rectA, rectB, pad = 0) => rectA.left < rectB.right + pad
    && rectA.right > rectB.left - pad
    && rectA.top < rectB.bottom + pad
    && rectA.bottom > rectB.top - pad,
};
vm.runInNewContext(`${helperSource}\nthis.chooseProtectedToolbarTop = chooseProtectedToolbarTop; this.chooseProtectedFloatingPlacement = chooseProtectedFloatingPlacement;`, context);
const choose = context.chooseProtectedToolbarTop;
const choosePlacement = context.chooseProtectedFloatingPlacement;

const avoidStart = source.indexOf("    function avoidSectionInsertOverlap(");
const avoidEnd = source.indexOf("\n\n    function avoidHomeMenuOverlap", avoidStart);
assert.ok(avoidStart >= 0 && avoidEnd > avoidStart, "section-insert avoidance helper must be extractable");
const avoidContext = {
  clamp: context.clamp,
  rectsOverlap: context.rectsOverlap,
  getVisibleSectionInsertRects: () => [rect(695.5, 654.3125, 729.5, 688.3125)],
};
vm.runInNewContext(`${source.slice(avoidStart, avoidEnd)}\nthis.avoidSectionInsertOverlap = avoidSectionInsertOverlap;`, avoidContext);
const avoidSectionInsert = avoidContext.avoidSectionInsertOverlap;

function rect(left, top, right, bottom) {
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

test("current 390 geometry places the automatic mobile toolbar above the protected title and trigger union", () => {
  const result = choose(
    8,
    293.810302734375,
    359,
    320,
    8,
    293.810302734375,
    [rect(102.2386, 510.7319, 337.6202, 550.3353), rect(21.1538, 395.0769, 99.1737, 448.9230)],
    8,
  );
  assert.equal(result.safe, true);
  assert.equal(result.strategy, "above-protected-union");
  assert.ok(Math.abs(result.top - 67.0769) < 0.001);
});

test("current PC toolbar moves above a visible section insertion button", () => {
  const result = avoidSectionInsert(139.421875, 598.03125, 680, 124, 8, 828);
  assert.ok(Math.abs(result - 520.3125) < 0.001);
  assert.match(source, /if \(!state\.toolbar\.manual\) \{\s*top = avoidSectionInsertOverlap\(/);
});

test("current 320 geometry uses the compact scrolling sheet and fits above the protected union", () => {
  assert.match(source, /@media \(max-width: 390px\)[\s\S]*?\.inline-toolbar\.mobile-sheet \{[\s\S]*?max-height: min\(34vh, 250px\);/);
  const result = choose(
    8,
    135.3207,
    289,
    250,
    8,
    135.3207,
    [rect(59.7424, 354.1017, 246.9388, 385.9520), rect(-8.4722, 269.4722, 60.2719, 316.9166)],
    8,
  );
  assert.equal(result.safe, true);
  assert.equal(result.strategy, "above-protected-union");
  assert.ok(Math.abs(result.top - 11.4722) < 0.001);
});

test("390 and smaller phones use the compact toolbar height needed between protected controls", () => {
  assert.match(source, /Compact phone scrollers leave the homepage menu, section controls/);
  assert.match(source, /@media \(max-width: 390px\) \{[\s\S]*?\.inline-toolbar\.mobile-sheet \{[\s\S]*?max-height: min\(34vh, 250px\);/);
});

test("current 320 closed background toggle moves to the safe right-side candidate", () => {
  const result = choosePlacement(
    [10, 199],
    277,
    96,
    44,
    10,
    199,
    8,
    337,
    [rect(8, 11.4722, 297, 261.4722), rect(59.7424, 354.1017, 246.9388, 385.9520), rect(-8.4722, 269.4722, 60.2719, 316.9166)],
    8,
  );
  assert.equal(result.safe, true);
  assert.equal(result.left, 199);
  assert.equal(result.strategy, "unchanged");
});

test("current 320 open background panel fits above the selected title and appearance trigger", () => {
  const result = choosePlacement(
    [10, 47],
    87,
    248,
    190,
    10,
    47,
    8,
    135,
    [rect(59.7424, 354.1017, 246.9388, 385.9520), rect(-8.4722, 269.4722, 60.2719, 316.9166), rect(18, 347, 74, 391)],
    8,
  );
  assert.equal(result.safe, true);
  assert.ok(Math.abs(result.top - 71.4722) < 0.001);
  assert.equal(result.strategy, "above-protected-union");
});

test("current PC open background panel clears the selected title and appearance trigger", () => {
  const result = choosePlacement(
    [14, 1172],
    197,
    260,
    499,
    8,
    1172,
    8,
    453,
    [rect(47.5, 684, 128.640625, 740), rect(205.421875, 752.390625, 918.90625, 806.78125)],
    8,
  );
  assert.equal(result.safe, true);
  assert.equal(result.left, 14);
  assert.ok(Math.abs(result.top - 177) < 0.001);
  assert.equal(result.strategy, "above-protected-union");
});

test("responsive background and decoration controls share compact protected placement at every responsive profile", () => {
  assert.match(source, /\.background-float\.responsive-compact \{[\s\S]*?grid-template-columns: 44px 44px;/);
  assert.match(source, /\.background-float\.responsive-compact \.background-float-toggle,[\s\S]*?\.background-float\.responsive-compact \.decoration-float-toggle \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;[\s\S]*?min-height: 44px;/);
  assert.match(source, /backgroundFloat\.classList\.toggle\("responsive-compact", responsive\);/);
  assert.match(source, /function getBackgroundFloatingProtectedRects\(\)[\s\S]*?\[selectedTitle, appearanceTrigger, inlineToolbar, inlineToolbarFloat, homepageMenu\][\s\S]*?getVisibleSectionInsertRects\(\)/);
  assert.match(source, /const protectedRects = getBackgroundFloatingProtectedRects\(\);/);
  assert.match(source, /if \(responsive\) \{[\s\S]*?chooseProtectedFloatingPlacement\(/);
  assert.match(source, /else \{[\s\S]*?chooseProtectedFloatingPlacement\(/);
  assert.doesNotMatch(source, /if \(window\.innerWidth <= 360 && state\.viewport === "phoneSmall"\) \{[\s\S]*?chooseProtectedFloatingPlacement\(/);
});

test("responsive toolbar jointly protects the homepage menu, title, appearance, and section-insert controls", () => {
  assert.match(source, /Resolve the homepage menu, title, appearance and section-insert/);
  assert.match(source, /const protectedRects = \[homepageMenu, selectedTitle, appearanceTrigger\][\s\S]*?\.concat\(getVisibleSectionInsertRects\(\)\);/);
});

test("an open section appearance surface suppresses the separate background surface", () => {
  assert.match(source, /body\.section-appearance-surface-open \.background-float/);
  assert.match(source, /\[inlineToolbar, inlineToolbarFloat, backgroundFloat\]\.forEach\(\(surface\) => \{/);
});

test("collapsed toolbar float chooses a clear side of the final background panel", () => {
  assert.match(source, /const finalBackgroundRect = backgroundFloat\.getBoundingClientRect\(\)/);
  assert.match(source, /rectsOverlap\(floatRectAt\(top\), finalBackgroundRect, 8\)/);
  assert.match(source, /const above = finalBackgroundRect\.top - height - 10/);
});

test("scaled mobile homepage brand remains a physical 44px target", () => {
  assert.match(source, /The visitor brand is scaled with the preview canvas/);
  assert.match(source, /\.stage\.mobile \.homepage-menu-mobile-brand \{[\s\S]*?min-height: 56px;/);
  const openBrandRules = [...source.matchAll(/\.stage\.mobile \.homepage-menu\.open \.homepage-menu-mobile-brand \{[\s\S]*?min-height: 56px;/g)];
  assert.equal(openBrandRules.length, 2);
  assert.doesNotMatch(source, /\.homepage-menu-mobile-brand \{[\s\S]{0,320}?min-height: (?:42|46|52)px;/);
  assert.ok(56 * 0.791667 >= 44, "56px authored target must survive the smallest supported stage scale");
});

test("responsive homepage menu hides the desktop-only move handle", () => {
  assert.match(source, /Menu dragging is desktop-only/);
  assert.match(source, /\.stage\.mobile \.homepage-menu-edit,\s*\.stage\.mobile \.homepage-menu-move \{\s*display: none;/);
  assert.match(source, /if \(state\.mode !== "edit" \|\| isResponsiveViewport\(\)\) return;/);
});

test("scaled responsive section controls remain physical 44px targets", () => {
  assert.match(source, /\.stage\.mobile \.section-insert-btn \{[\s\S]*?width: 56px;[\s\S]*?height: 56px;/);
  assert.match(source, /\.stage\.mobile \.section-delete-marker \{[\s\S]*?width: 56px;[\s\S]*?height: 56px;/);
  assert.ok(56 * 0.791667 >= 44, "responsive section controls must survive the smallest supported stage scale");
});

test("staff dock controls retain 44px width and height at every outer viewport", () => {
  assert.match(source, /\.staff-editor-dock button \{[\s\S]*?min-width: 44px;[\s\S]*?min-height: 44px;/);
  assert.match(source, /@media \(max-width: 720px\)[\s\S]*?\.staff-editor-dock button \{[\s\S]*?min-width: 44px;/);
  assert.doesNotMatch(source, /\.staff-editor-dock button \{[\s\S]{0,180}?min-width: 0;/);
});

test("responsive inline toolbar exposes 44px discrete and range controls", () => {
  assert.match(source, /\.inline-toolbar\.mobile-sheet \.toolbar-control input\[type="range"\] \{[\s\S]*?min-height: 44px;/);
  assert.match(source, /Responsive editing keeps every discrete control and every slider track/);
  assert.match(source, /\.inline-toolbar\.mobile-sheet button,[\s\S]*?\.inline-toolbar\.mobile-sheet input\[type="color"\] \{[\s\S]*?min-width: 44px;[\s\S]*?min-height: 44px;/);
});

test("responsive background panel exposes 44px inputs, buttons, colors, and range", () => {
  assert.match(source, /\.background-float-panel input\[readonly\] \{[\s\S]*?height: 44px;/);
  assert.match(source, /\.background-float-actions button,[\s\S]*?\.background-float-color button \{[\s\S]*?min-height: 44px;/);
  assert.match(source, /\.background-float-color input\[type="color"\] \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/);
  assert.match(source, /\.theme-custom-row input\[type="color"\] \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/);
  assert.match(source, /\.theme-custom-row button \{[\s\S]*?min-height: 44px;/);
  assert.match(source, /\.background-float-control input\[type="range"\] \{[\s\S]*?min-height: 44px;/);
});

test("background placement is recomputed after the final toolbar layout", () => {
  assert.match(source, /\.inline-toolbar\.measuring-position \{\s*transition: none;/);
  assert.match(source, /inlineToolbar\.classList\.add\("measuring-position"\);[\s\S]*?translate\(-9999px, -9999px\)/);
  assert.match(source, /Range\/select sizing can settle after the toolbar transform/);
  assert.match(source, /temporary -9999px measurement position must never be accepted/);
  assert.match(source, /inlineToolbar\.style\.transform = `translate\(\$\{left\}px, \$\{top\}px\)`;[\s\S]*?inlineToolbar\.getBoundingClientRect\(\);[\s\S]*?updateBackgroundFloatPosition\(\);[\s\S]*?inlineToolbar\.classList\.remove\("measuring-position"\);[\s\S]*?scheduleLayoutTask\("backgroundFloatAfterInlineToolbar", updateBackgroundFloatPosition\);/);
});

test("current 390 closed background and decoration row can move above the toolbar-title-trigger union", () => {
  const result = choosePlacement(
    [10, 284],
    270,
    96,
    44,
    10,
    284,
    8,
    720,
    [
      rect(8, 66.0769, 367, 386.0769),
      rect(21.1538, 395.0769, 99.1737, 448.9230),
      rect(102.2386, 510.7319, 337.6202, 550.3353),
    ],
    8,
  );
  assert.equal(result.safe, true);
  assert.equal(result.strategy, "above-protected-union");
  assert.ok(Math.abs(result.top - 14.0769) < 0.001);
});

test("below-only geometry chooses the safe candidate below the protected union", () => {
  const result = choose(0, 30, 180, 100, 0, 400, [rect(10, 30, 170, 160)], 8);
  assert.deepEqual({ top: result.top, safe: result.safe, strategy: result.strategy }, {
    top: 168,
    safe: true,
    strategy: "below-protected-union",
  });
});

test("fragmented protected surfaces use a real interior gap before failing closed", () => {
  const result = choose(
    0,
    389,
    96,
    44,
    8,
    600,
    [rect(0, 0, 120, 100), rect(0, 357, 745, 677)],
    8,
  );
  assert.deepEqual({ top: result.top, safe: result.safe, strategy: result.strategy }, {
    top: 305,
    safe: true,
    strategy: "nearest-protected-gap",
  });
});

test("non-overlapping geometry remains unchanged", () => {
  const result = choose(0, 20, 100, 60, 0, 300, [rect(220, 30, 300, 90)], 8);
  assert.deepEqual({ top: result.top, safe: result.safe, strategy: result.strategy }, {
    top: 20,
    safe: true,
    strategy: "unchanged",
  });
});

test("geometry with no safe candidate reports an explicit unsafe fallback", () => {
  const result = choose(0, 10, 100, 100, 0, 50, [rect(0, 40, 100, 80)], 8);
  assert.deepEqual({ top: result.top, safe: result.safe, strategy: result.strategy }, {
    top: 10,
    safe: false,
    strategy: "no-safe-candidate-fallback",
  });
});

test("manual toolbar positions bypass automatic protected-placement changes", () => {
  assert.match(source, /if \(useMobileSheet && isResponsiveViewport\(\) && !state\.toolbar\.manual\)/);
  assert.match(source, /selectedPart === "title"/);
  assert.match(source, /sectionAppearanceAvoidanceSafe/);
});
