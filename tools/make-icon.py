#!/usr/bin/env python3
"""Generate the launcher icon at every density. Run from the repo root:

    python3 tools/make-icon.py

A prompt caret and a cursor on near-black: the same mark the demo GIF opens with.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "apps/mobile/android/app/src/main/res"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
BG, FG = (11, 13, 16), (110, 231, 168)
DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


def icon(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)
    r = max(4, size // 6)
    d.rounded_rectangle([0, 0, size - 1, size - 1], r, fill=BG, outline=(35, 42, 51), width=max(1, size // 48))
    font = ImageFont.truetype(FONT, int(size * 0.52))
    text = ">_"
    box = d.textbbox((0, 0), text, font=font)
    d.text(((size - (box[2] - box[0])) / 2 - box[0], (size - (box[3] - box[1])) / 2 - box[1] - size * 0.03),
           text, font=font, fill=FG)
    return img


def main():
    for name, size in DENSITIES.items():
        d = RES / f"mipmap-{name}"
        d.mkdir(parents=True, exist_ok=True)
        icon(size).save(d / "ic_launcher.png")
        print(f"{d / 'ic_launcher.png'}  {size}x{size}")
    (ROOT / "docs").mkdir(exist_ok=True)
    icon(512).save(ROOT / "docs" / "icon.png")
    print(f"{ROOT / 'docs/icon.png'}  512x512 (store listing)")


if __name__ == "__main__":
    main()
