import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const visualSource = fs.readFileSync(new URL("../outputs/editor-visual-asset-manager.js", import.meta.url), "utf8");
const source = fs.readFileSync(new URL("../outputs/editor-donation-manager.js", import.meta.url), "utf8");
const context = { window: {}, structuredClone };
vm.createContext(context);
vm.runInContext(visualSource, context);
vm.runInContext(source, context);
const manager = context.window.EditorDonationManager;

assert.ok(manager);
assert.equal(manager.isSection("donation"), true);
assert.equal(manager.isSection("donation3"), true);
assert.equal(manager.isSection("history"), false);

const base = manager.createDefaultModel();
assert.equal(base.cards.length, 5);
assert.equal(base.cards[0].title, "기금 후원");
assert.ok(manager.ICONS.recurring.body.includes("path"));
assert.equal(base.backgroundColor, null);
assert.equal(base.accentColor, null);
assert.equal(base.decorations.length, 1);
assert.equal(base.decorations[0].icon, "heart");
assert.equal(base.decorations[0].style, "plain");
assert.equal(base.decorations[0].sizes.desktop, 58);
assert.deepEqual({ ...base.decorations[0].layouts.desktop }, { x: 50, y: 90 });
assert.ok(Object.keys(manager.ICONS).length >= 20);

const decorated = manager.normalizeModel({
  decoration: { icon: "sprout", style: "double-ring" },
  cards: []
});
assert.equal(decorated.decorations[0].icon, "sprout");
assert.equal(decorated.decorations[0].style, "double-ring");
const decorationAdded = manager.addDecoration(base, "phone");
assert.equal(decorationAdded.decorations.length, 2);
assert.equal(decorationAdded.decorations[1].sizes.phone, 50);
const decorationRemoved = manager.removeDecoration(decorationAdded, decorationAdded.decorations[0].id);
assert.equal(decorationRemoved.decorations.length, 1);

const customColors = manager.normalizeModel({
  cards: [{ id: "donation-card-1", title: "기존 후원", icon: "heart" }],
  backgroundColor: "#F1F5F9",
  accentColor: "#315F75"
});
assert.equal(customColors.backgroundColor, null);
assert.equal(customColors.accentColor, null);
assert.equal(customColors.cards[0].backgroundColor, "#f1f5f9");
assert.equal(customColors.cards[0].accentColor, "#315f75");

const customCard = manager.normalizeModel({
  cards: [{ id: "donation-card-1", title: "강조 후원", icon: "heart", backgroundColor: "#FDF2F8", accentColor: "#BE185D" }],
  ctaBackgroundColor: "#7C3AED"
});
assert.equal(customCard.cards[0].backgroundColor, "#fdf2f8");
assert.equal(customCard.cards[0].accentColor, "#be185d");
assert.equal(customCard.ctaBackgroundColor, "#7c3aed");

const added = manager.addCard(base);
assert.equal(added.cards.length, 6);
assert.equal(base.cards.length, 5);
assert.equal(added.cards[5].title, "새 후원 방법");

const moved = manager.moveItem(added.cards, added.cards[5].id, "up");
assert.equal(moved[4].id, added.cards[5].id);

const removed = manager.removeCard(added, added.cards[1].id);
assert.equal(removed.cards.length, 5);
assert.equal(removed.cards.some((card) => card.id === added.cards[1].id), false);

assert.ok(manager.estimateHeight(base, "phone") > manager.estimateHeight(base, "desktop"));
assert.equal(manager.normalizeModel({ cards: [] }).cards.length, 0);

console.log("donation manager tests OK");
