import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("community page renders normalized decorations as non-interactive visual layers", async () => {
  const source = await readFile(new URL("delivery-site/app/board-app.tsx", root), "utf8");

  assert.match(source, /CommunityDecorationLayer layer="back" decorations=\{communitySurface\.pageDecorations\.decorations\}/);
  assert.match(source, /CommunityDecorationLayer layer="front" decorations=\{communitySurface\.pageDecorations\.decorations\}/);
  assert.match(source, /data-community-decoration-layer=\{layer\}/);
  assert.match(source, /data-community-decoration-id=\{decoration\.id\}/);
  assert.match(source, /data-community-decoration-icon=\{decoration\.icon\}/);
  assert.match(source, /data-community-decoration-style=\{style\}/);
  assert.match(source, /sticker-imported-\\d\{2\}-\\d\{2\}/);
  assert.match(source, /communityDecorationStyles\.has\(decoration\.style\)/);
});

test("community decoration CSS preserves viewport geometry and public click-through", async () => {
  const css = await readFile(new URL("delivery-site/app/globals.css", root), "utf8");

  assert.match(css, /\.community-decoration-layer\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /\.community-decoration\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /--community-decoration-x-desktop/);
  assert.match(css, /--community-decoration-x-tablet/);
  assert.match(css, /--community-decoration-x-phone/);
  assert.match(css, /--community-decoration-x-phone-small/);
  assert.match(css, /\.community-decoration--diamond/);
  assert.match(css, /\.community-decoration--capsule/);
  assert.match(css, /\.community-decoration-mask/);
  assert.match(css, /\.community-decoration-raster/);
});
