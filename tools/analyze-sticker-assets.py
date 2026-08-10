"""Inspect downloaded sticker PNGs and build visual QA contact sheets.

The script never changes source PNGs. It records alpha/color characteristics so
the editor registry can distinguish ordinary transparent overlays from bright
or glow-oriented assets without relying on filenames alone.
"""

from __future__ import annotations

import colorsys
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "outputs" / "assets" / "stickers" / "original"
REPORT_PATH = ROOT / "outputs" / "assets" / "stickers" / "sticker-analysis.json"
CONTACT_DIR = ROOT / "outputs" / "assets" / "stickers" / "contact-sheets"
FILE_PATTERN = re.compile(r"decoration-(\d{2})\.png$")


def checkerboard(size: tuple[int, int], cell: int = 16) -> Image.Image:
    """Return a neutral checkerboard that makes transparent edges visible."""
    board = Image.new("RGB", size, "#f7f7f4")
    draw = ImageDraw.Draw(board)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill="#e6ebe7")
    return board


def analyze_image(path: Path) -> dict[str, object]:
    """Measure transparency, visible bounds, brightness and glow-like pixels."""
    with Image.open(path) as source:
        rgba = source.convert("RGBA")
        width, height = rgba.size
        alpha = rgba.getchannel("A")
        bbox = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()

        sample = rgba.copy()
        sample.thumbnail((320, 320), Image.Resampling.LANCZOS)
        pixels = list(sample.getdata())
        total = max(1, len(pixels))
        transparent = sum(1 for _, _, _, a in pixels if a < 16)
        translucent = sum(1 for _, _, _, a in pixels if 16 <= a < 240)
        visible = [(r, g, b, a) for r, g, b, a in pixels if a >= 16]

        saturation_total = 0.0
        brightness_total = 0.0
        neon_pixels = 0
        glow_pixels = 0
        for red, green, blue, pixel_alpha in visible:
            _, saturation, brightness = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
            saturation_total += saturation
            brightness_total += brightness
            if saturation >= 0.58 and brightness >= 0.78:
                neon_pixels += 1
            if pixel_alpha < 220 and saturation >= 0.35 and brightness >= 0.72:
                glow_pixels += 1

        visible_count = max(1, len(visible))
        visible_area_ratio = 0.0
        if bbox:
            visible_area_ratio = ((bbox[2] - bbox[0]) * (bbox[3] - bbox[1])) / max(1, width * height)

        transparency_ratio = transparent / total
        translucent_ratio = translucent / total
        neon_ratio = neon_pixels / visible_count
        glow_ratio = glow_pixels / visible_count
        average_saturation = saturation_total / visible_count
        average_brightness = brightness_total / visible_count

        # This first-pass signal only separates likely bright/glow artwork. The
        # final semantic category is assigned after the contact-sheet review.
        appearance = "neon-candidate" if neon_ratio >= 0.2 or glow_ratio >= 0.18 else "standard"

        return {
            "id": f"sticker-decoration-{FILE_PATTERN.search(path.name).group(1)}",
            "sourceFile": path.name,
            "width": width,
            "height": height,
            "alpha": True,
            "contentBounds": list(bbox) if bbox else None,
            "visibleAreaRatio": round(visible_area_ratio, 4),
            "transparentRatio": round(transparency_ratio, 4),
            "translucentRatio": round(translucent_ratio, 4),
            "averageSaturation": round(average_saturation, 4),
            "averageBrightness": round(average_brightness, 4),
            "neonRatio": round(neon_ratio, 4),
            "glowRatio": round(glow_ratio, 4),
            "appearanceSignal": appearance,
        }


def make_contact_sheet(records: list[dict[str, object]], page_index: int) -> Path:
    """Build a labelled checkerboard sheet for human visual classification."""
    columns, rows = 4, 5
    cell_width, cell_height = 300, 240
    sheet = Image.new("RGB", (columns * cell_width, rows * cell_height), "#eef3ef")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()

    for index, record in enumerate(records):
        column = index % columns
        row = index // columns
        left = column * cell_width
        top = row * cell_height
        preview = checkerboard((cell_width - 20, cell_height - 46))
        with Image.open(SOURCE_DIR / str(record["sourceFile"])) as source:
            rgba = source.convert("RGBA")
            rgba.thumbnail((cell_width - 36, cell_height - 62), Image.Resampling.LANCZOS)
            x = (preview.width - rgba.width) // 2
            y = (preview.height - rgba.height) // 2
            preview.paste(rgba, (x, y), rgba)
        sheet.paste(preview, (left + 10, top + 10))
        label = f'{record["id"]} | {record["appearanceSignal"]}'
        draw.text((left + 12, top + cell_height - 28), label, fill="#17392d", font=font)
        draw.rectangle((left, top, left + cell_width - 1, top + cell_height - 1), outline="#a9bbb1", width=1)

    CONTACT_DIR.mkdir(parents=True, exist_ok=True)
    output = CONTACT_DIR / f"decorations-{page_index:02d}.png"
    sheet.save(output, optimize=True)
    return output


def main() -> None:
    files = sorted(
        (path for path in SOURCE_DIR.glob("decoration-*.png") if FILE_PATTERN.match(path.name)),
        key=lambda path: int(FILE_PATTERN.match(path.name).group(1)),
    )
    if len(files) != 40:
        raise SystemExit(f"Expected 40 decoration PNGs, found {len(files)}")

    records = [analyze_image(path) for path in files]
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(
        json.dumps({"version": 1, "count": len(records), "items": records}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    sheets = [make_contact_sheet(records[index : index + 20], page + 1) for page, index in enumerate(range(0, len(records), 20))]
    print(json.dumps({"count": len(records), "report": str(REPORT_PATH), "contactSheets": [str(path) for path in sheets]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
