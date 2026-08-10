"""Split the 40 user-provided sticker sheets into transparent web assets.

The Drive originals remain untouched. Grid definitions are explicit because each
source sheet is a curated set with a stable row/column contract; this makes the
generated registry deterministic and repeatable for future editor releases.
"""

from __future__ import annotations

import json
from collections import deque
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "outputs" / "assets" / "stickers" / "original"
WEB_DIR = ROOT / "outputs" / "assets" / "stickers" / "web"
QA_DIR = ROOT / "outputs" / "assets" / "stickers" / "library-contact-sheets"
REGISTRY_JSON = ROOT / "outputs" / "assets" / "stickers" / "sticker-registry.json"
MANIFEST_JS = ROOT / "outputs" / "editor-imported-sticker-manifest.js"


@dataclass(frozen=True)
class SheetSpec:
    columns: int
    rows: int
    category: str
    category_label: str
    style: str


# 대분류 asset / 중분류 sticker / 소분류 stable item ID.
# UI categories intentionally merge similar source sheets so hundreds of items
# remain discoverable without exposing implementation-oriented sheet numbers.
SHEET_SPECS: dict[int, SheetSpec] = {
    1: SheetSpec(4, 5, "daily", "사람·일상", "outline"),
    2: SheetSpec(4, 5, "animal", "동물", "outline"),
    3: SheetSpec(4, 5, "daily", "사람·일상", "outline"),
    4: SheetSpec(4, 3, "daily", "사람·일상", "vintage-color"),
    5: SheetSpec(4, 3, "daily", "사람·일상", "color"),
    6: SheetSpec(3, 3, "daily", "사람·일상", "color"),
    7: SheetSpec(3, 3, "daily", "사람·일상", "character"),
    8: SheetSpec(3, 3, "daily", "사람·일상", "symbol"),
    9: SheetSpec(4, 5, "nature", "자연·계절", "outline"),
    10: SheetSpec(4, 5, "daily", "사람·일상", "outline"),
    11: SheetSpec(4, 5, "animal", "동물", "outline"),
    12: SheetSpec(4, 5, "animal", "동물", "outline"),
    13: SheetSpec(4, 5, "nature", "자연·계절", "outline"),
    14: SheetSpec(4, 5, "nature", "자연·계절", "outline"),
    15: SheetSpec(4, 5, "nature", "자연·계절", "outline"),
    16: SheetSpec(3, 3, "nature", "자연·계절", "brush"),
    17: SheetSpec(4, 5, "neon", "형광·네온", "neon-dark"),
    18: SheetSpec(5, 2, "neon", "형광·네온", "neon-light"),
    19: SheetSpec(4, 5, "nature", "자연·계절", "outline"),
    20: SheetSpec(5, 4, "nature", "자연·계절", "color"),
    21: SheetSpec(4, 5, "nature", "자연·계절", "color"),
    22: SheetSpec(4, 5, "nature", "자연·계절", "color"),
    23: SheetSpec(4, 5, "nature", "자연·계절", "color"),
    24: SheetSpec(4, 5, "neon", "형광·네온", "neon-light"),
    25: SheetSpec(4, 5, "neon", "형광·네온", "neon-gray"),
    26: SheetSpec(1, 1, "botanical", "보태니컬", "engraving"),
    27: SheetSpec(1, 1, "botanical", "보태니컬", "engraving"),
    28: SheetSpec(1, 1, "botanical", "보태니컬", "engraving"),
    29: SheetSpec(1, 1, "botanical", "보태니컬", "engraving"),
    30: SheetSpec(1, 1, "botanical", "보태니컬", "engraving"),
    31: SheetSpec(1, 1, "botanical", "보태니컬", "engraving"),
    32: SheetSpec(1, 1, "botanical", "보태니컬", "engraving"),
    33: SheetSpec(1, 1, "botanical", "보태니컬", "engraving"),
    34: SheetSpec(1, 1, "botanical", "보태니컬", "engraving"),
    35: SheetSpec(1, 1, "botanical", "보태니컬", "engraving"),
    36: SheetSpec(4, 5, "neon", "형광·네온", "neon-light"),
    37: SheetSpec(4, 5, "neon", "형광·네온", "neon-light"),
    38: SheetSpec(4, 5, "neon", "형광·네온", "neon-gray"),
    39: SheetSpec(4, 5, "neon", "형광·네온", "neon-gray"),
    40: SheetSpec(5, 4, "neon", "형광·네온", "neon-dark"),
}

# Sheet 16 has four items only in its last row, so its cells need explicit
# normalized coordinates instead of a uniform grid.
CUSTOM_CELL_BOXES: dict[int, tuple[tuple[float, float, float, float], ...]] = {
    16: (
        (0.00, 0.00, 0.33, 0.34), (0.33, 0.00, 0.67, 0.34), (0.67, 0.00, 1.00, 0.34),
        (0.00, 0.32, 0.33, 0.68), (0.33, 0.32, 0.67, 0.68), (0.67, 0.32, 1.00, 0.68),
        (0.00, 0.64, 0.25, 1.00), (0.25, 0.64, 0.50, 1.00),
        (0.50, 0.64, 0.75, 1.00), (0.75, 0.64, 1.00, 1.00),
    ),
}

# Watercolour sheets 4-8 place their grids inside generous paper margins.
# Restricting the split to the artwork bounds prevents neighbouring halves.
SHEET_GRID_BOUNDS: dict[int, tuple[float, float, float, float]] = {
    4: (0.14, 0.00, 0.86, 1.00),
    5: (0.14, 0.00, 0.86, 1.00),
    6: (0.14, 0.00, 0.86, 1.00),
    7: (0.14, 0.00, 0.86, 1.00),
    8: (0.14, 0.00, 0.86, 1.00),
    20: (0.00, 0.00, 1.00, 0.82),
    21: (0.00, 0.03, 1.00, 0.85),
    22: (0.00, 0.03, 1.00, 0.85),
    23: (0.00, 0.00, 1.00, 1.00),
}

# A small inward crop removes artwork from neighbouring cells without cutting
# the intended subject or the soft neon halo. Values are proportions of one cell.
SHEET_CELL_INSET: dict[int, float] = {
    **{number: 0.025 for number in (1, 2, 3, 9, 10, 11, 12, 13, 14, 15, 16, 19)},
    **{number: 0.025 for number in (17, 18, 24, 25, 36, 37, 38, 39, 40)},
    20: 0.02,
    **{number: 0.03 for number in (21, 22, 23)},
}


def infer_background(rgb: np.ndarray) -> np.ndarray:
    """Use the cell perimeter median as the matte color for opaque sheets."""
    border = max(2, min(rgb.shape[0], rgb.shape[1]) // 40)
    samples = np.concatenate(
        [
            rgb[:border].reshape(-1, 3),
            rgb[-border:].reshape(-1, 3),
            rgb[:, :border].reshape(-1, 3),
            rgb[:, -border:].reshape(-1, 3),
        ],
        axis=0,
    )
    return np.median(samples, axis=0).astype(np.float32)


def remove_matte(cell: Image.Image) -> Image.Image:
    """Convert a light, gray or dark flat matte to feathered transparency."""
    rgba = np.asarray(cell.convert("RGBA"), dtype=np.float32)
    rgb = rgba[:, :, :3]
    source_alpha = rgba[:, :, 3]
    if np.mean(source_alpha < 250) > 0.02:
        return cell.convert("RGBA")

    background = infer_background(rgb)
    difference = np.max(np.abs(rgb - background), axis=2)
    alpha = np.clip((difference - 2.0) / 0.72, 0, 255)
    alpha_ratio = alpha[:, :, None] / 255.0
    safe_alpha = np.maximum(alpha_ratio, 1 / 255)
    foreground = (rgb - background * (1.0 - alpha_ratio)) / safe_alpha
    foreground = np.clip(foreground, 0, 255)
    foreground[alpha < 2] = 0
    output = np.dstack((foreground, alpha)).astype(np.uint8)
    return Image.fromarray(output, "RGBA")


def trim_and_size(image: Image.Image, max_dimension: int = 512) -> Image.Image | None:
    """Trim empty canvas, retain glow edges and add safe placement padding."""
    rgba = image.convert("RGBA")
    alpha = np.asarray(rgba.getchannel("A"))
    visible = np.where(alpha > 3)
    if not visible[0].size:
        return None
    top, bottom = int(visible[0].min()), int(visible[0].max()) + 1
    left, right = int(visible[1].min()), int(visible[1].max()) + 1
    cropped = rgba.crop((left, top, right, bottom))
    padding = max(8, round(max(cropped.size) * 0.06))
    padded = Image.new("RGBA", (cropped.width + padding * 2, cropped.height + padding * 2), (0, 0, 0, 0))
    padded.paste(cropped, (padding, padding), cropped)
    if max(padded.size) > max_dimension:
        scale = max_dimension / max(padded.size)
        padded = padded.resize((max(1, round(padded.width * scale)), max(1, round(padded.height * scale))), Image.Resampling.LANCZOS)
    return padded


def clear_edge_fragments(image: Image.Image) -> Image.Image:
    """Remove small neighbouring fragments that remain inside a crop edge band."""
    rgba = image.convert("RGBA")
    alpha = np.asarray(rgba.getchannel("A"))
    foreground = alpha > 28
    height, width = foreground.shape
    visited = np.zeros_like(foreground, dtype=bool)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        if foreground[0, x]: queue.append((0, x))
        if foreground[height - 1, x]: queue.append((height - 1, x))
    for y in range(height):
        if foreground[y, 0]: queue.append((y, 0))
        if foreground[y, width - 1]: queue.append((y, width - 1))
    while queue:
        y, x = queue.popleft()
        if visited[y, x] or not foreground[y, x]:
            continue
        visited[y, x] = True
        for next_y in range(max(0, y - 1), min(height, y + 2)):
            for next_x in range(max(0, x - 1), min(width, x + 2)):
                if not visited[next_y, next_x] and foreground[next_y, next_x]:
                    queue.append((next_y, next_x))
    foreground_count = int(foreground.sum())
    removable = visited.copy()

    # Some sheets leave a white gap between a neighbouring fragment and the
    # crop boundary. Remove components contained entirely in the outer 12%
    # band, while preserving artwork that reaches into the centre of its cell.
    remaining = foreground & ~visited
    seen = np.zeros_like(foreground, dtype=bool)
    edge_band_y = max(8, round(height * 0.12))
    edge_band_x = max(8, round(width * 0.12))
    for seed_y, seed_x in zip(*np.where(remaining & ~seen)):
        if seen[seed_y, seed_x]:
            continue
        component: list[tuple[int, int]] = []
        component_queue: deque[tuple[int, int]] = deque([(int(seed_y), int(seed_x))])
        while component_queue:
            y, x = component_queue.popleft()
            if seen[y, x] or not remaining[y, x]:
                continue
            seen[y, x] = True
            component.append((y, x))
            for next_y in range(max(0, y - 1), min(height, y + 2)):
                for next_x in range(max(0, x - 1), min(width, x + 2)):
                    if not seen[next_y, next_x] and remaining[next_y, next_x]:
                        component_queue.append((next_y, next_x))
        if not component:
            continue
        ys = [point[0] for point in component]
        xs = [point[1] for point in component]
        inside_edge_band = (
            max(ys) < edge_band_y
            or min(ys) >= height - edge_band_y
            or max(xs) < edge_band_x
            or min(xs) >= width - edge_band_x
        )
        if inside_edge_band and len(component) < foreground_count * 0.32:
            for y, x in component:
                removable[y, x] = True

    # Never erase the main subject if a crop happens to touch an outer edge.
    if not removable.any() or not foreground_count or int(removable.sum()) >= foreground_count * 0.48:
        return rgba
    edge_mask = Image.fromarray((removable * 255).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(9))
    output = np.asarray(rgba).copy()
    output[np.asarray(edge_mask) > 0, 3] = 0
    return Image.fromarray(output, "RGBA")


def split_sheet(number: int, spec: SheetSpec) -> list[dict[str, object]]:
    """Split one registered sheet and return manifest records for valid cells."""
    source_path = SOURCE_DIR / f"decoration-{number:02d}.png"
    with Image.open(source_path) as source:
        rgba = source.convert("RGBA")
        width, height = rgba.size
        records: list[dict[str, object]] = []
        boxes = CUSTOM_CELL_BOXES.get(number)
        if boxes is None:
            grid_left, grid_top, grid_right, grid_bottom = SHEET_GRID_BOUNDS.get(number, (0.0, 0.0, 1.0, 1.0))
            boxes = tuple(
                (
                    grid_left + (grid_right - grid_left) * column / spec.columns,
                    grid_top + (grid_bottom - grid_top) * row / spec.rows,
                    grid_left + (grid_right - grid_left) * (column + 1) / spec.columns,
                    grid_top + (grid_bottom - grid_top) * (row + 1) / spec.rows,
                )
                for row in range(spec.rows)
                for column in range(spec.columns)
            )
        for item_index, box in enumerate(boxes, start=1):
            left = round(box[0] * width)
            top = round(box[1] * height)
            right = round(box[2] * width)
            bottom = round(box[3] * height)
            inset = SHEET_CELL_INSET.get(number, 0.0)
            if inset:
                inset_x = round((right - left) * inset)
                inset_y = round((bottom - top) * inset)
                left, top, right, bottom = left + inset_x, top + inset_y, right - inset_x, bottom - inset_y
            separated = remove_matte(rgba.crop((left, top, right, bottom)))
            if spec.columns > 1 or spec.rows > 1:
                separated = clear_edge_fragments(separated)
            prepared = trim_and_size(separated)
            if prepared is None:
                continue
            minor_id = f"imported-{number:02d}-{item_index:02d}"
            asset_id = f"sticker-{minor_id}"
            file_name = f"{asset_id}.webp"
            output_path = WEB_DIR / file_name
            prepared.save(output_path, "WEBP", lossless=True, method=6, exact=True)
            records.append(
                {
                    "id": asset_id,
                    "taxonomyId": f"asset.sticker.{minor_id}",
                    "label": f"{spec.category_label} 스티커 {number:02d}-{item_index:02d}",
                    "category": spec.category,
                    "categoryLabel": spec.category_label,
                    "style": spec.style,
                    "asset": f"assets/stickers/web/{file_name}",
                    "source": f"assets/stickers/original/decoration-{number:02d}.png",
                    "sourceSheet": number,
                    "sourceCell": item_index,
                    "width": prepared.width,
                    "height": prepared.height,
                    "version": 1,
                    "status": "approved-source",
                    "license": "user-provided",
                    "transparent": True,
                }
            )
        return records


def make_contact_sheets(items: list[dict[str, object]]) -> list[str]:
    """Render compact catalog pages so extraction edges can be reviewed quickly."""
    QA_DIR.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default()
    columns, rows = 8, 8
    cell_width, cell_height = 150, 145
    outputs: list[str] = []
    for page, offset in enumerate(range(0, len(items), columns * rows), start=1):
        page_items = items[offset : offset + columns * rows]
        sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), "#f3f7f4")
        draw = ImageDraw.Draw(sheet)
        for index, item in enumerate(page_items):
            x = (index % columns) * cell_width
            y = (index // columns) * cell_height
            tile = Image.new("RGB", (cell_width - 10, cell_height - 28), "#f9faf8")
            tile_draw = ImageDraw.Draw(tile)
            for yy in range(0, tile.height, 12):
                for xx in range(0, tile.width, 12):
                    if (xx // 12 + yy // 12) % 2:
                        tile_draw.rectangle((xx, yy, xx + 11, yy + 11), fill="#e4ebe6")
            with Image.open(ROOT / "outputs" / str(item["asset"])) as sticker:
                rgba = sticker.convert("RGBA")
                rgba.thumbnail((tile.width - 16, tile.height - 16), Image.Resampling.LANCZOS)
                tile.paste(rgba, ((tile.width - rgba.width) // 2, (tile.height - rgba.height) // 2), rgba)
            sheet.paste(tile, (x + 5, y + 5))
            draw.text((x + 7, y + cell_height - 19), str(item["id"]).replace("sticker-imported-", ""), fill="#17392d", font=font)
            draw.rectangle((x, y, x + cell_width - 1, y + cell_height - 1), outline="#a8bcb0")
        path = QA_DIR / f"sticker-library-{page:02d}.jpg"
        sheet.save(path, "JPEG", quality=88, optimize=True)
        outputs.append(str(path.relative_to(ROOT)).replace("\\", "/"))
    return outputs


def main() -> None:
    missing = [number for number in SHEET_SPECS if not (SOURCE_DIR / f"decoration-{number:02d}.png").exists()]
    if missing:
        raise SystemExit(f"Missing source sheets: {missing}")

    WEB_DIR.mkdir(parents=True, exist_ok=True)
    for stale in WEB_DIR.glob("sticker-imported-*.webp"):
        stale.unlink()

    items: list[dict[str, object]] = []
    for number, spec in sorted(SHEET_SPECS.items()):
        items.extend(split_sheet(number, spec))

    counts: dict[str, int] = {}
    for item in items:
        counts[str(item["category"])] = counts.get(str(item["category"]), 0) + 1

    registry = {
        "version": 1,
        "sourceFolder": "Google Drive/0. 스티커",
        "sourceSheetCount": 40,
        "itemCount": len(items),
        "categoryCounts": counts,
        "items": items,
    }
    REGISTRY_JSON.write_text(json.dumps(registry, ensure_ascii=False, indent=2), encoding="utf-8")
    MANIFEST_JS.write_text(
        "/* Generated by tools/build-sticker-library.py; edit the source registry, not this file. */\n"
        f"window.EditorImportedStickerManifest = Object.freeze({json.dumps(registry, ensure_ascii=False, separators=(',', ':'))});\n",
        encoding="utf-8",
    )
    contact_sheets = make_contact_sheets(items)
    print(json.dumps({"sourceSheets": 40, "items": len(items), "categories": counts, "contactSheets": contact_sheets}, ensure_ascii=False))


if __name__ == "__main__":
    main()
