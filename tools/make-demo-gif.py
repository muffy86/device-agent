#!/usr/bin/env python3
"""Render docs/demo.gif from the real CLI transcript.

The transcript is not staged: it is the output of
    node apps/cli/index.js --mock --yes --data /tmp/demo --root . "what is in this repo"
Next to it, docs/PROMPT.md records the exact command.
"""
import re, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "demo-transcript.txt"
OUT_GIF = ROOT / "docs" / "demo.gif"
OUT_PNG = ROOT / "docs" / "demo.png"

W, H = 1040, 600
PAD, LH = 22, 19
COLS = 96
BG, BAR, TEXT, DIM = (11, 13, 16), (24, 28, 34), (230, 233, 238), (139, 149, 163)
GREEN, RED, AMBER, PROMPT = (110, 231, 168), (239, 111, 111), (244, 162, 97), (255, 255, 255)

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
FONTB = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
f = ImageFont.truetype(FONT, 14)
fb = ImageFont.truetype(FONTB, 14)


def colour(line):
    if "✓" in line:
        return GREEN
    if "✗" in line or line.startswith("refused"):
        return RED
    if line.startswith("—") or line.startswith("  ledger") or line.startswith("provider=") or line.startswith("chain ") or line.startswith("ledger seq") or line.startswith("file unchanged") or line.startswith("agent wants"):
        return DIM
    if line.startswith("$ "):
        return PROMPT
    if "budget cap" in line:
        return AMBER
    if line.startswith("- "):
        return DIM
    return TEXT


def frames():
    raw = SRC.read_text().splitlines()
    lines = []
    for ln in raw:
        ln = ln.replace("\t", "    ").rstrip()
        while len(ln) > COLS:
            lines.append(ln[:COLS - 1] + "…")
            ln = "    " + ln[COLS - 1:]
        lines.append(ln)
    # drop empty runs, keep one blank between blocks
    cleaned = []
    for ln in lines:
        if ln.strip() == "" and cleaned and cleaned[-1].strip() == "":
            continue
        cleaned.append(ln)
    lines = cleaned

    prompt = "$ node apps/cli/index.js --mock --yes \"what is in this repo\""
    stream = [(prompt, True)] + [(l, False) for l in lines]

    per_frame = 5
    typed = [("", True)]
    out = []
    idx, col = 0, 0
    while idx < len(stream):
        for _ in range(per_frame):
            if idx >= len(stream):
                break
            text, is_prompt = stream[idx]
            col += 1
            if col > len(text):
                typed[-1] = (text, is_prompt)
                idx += 1
                col = 0
                if idx < len(stream):
                    typed.append(("", False))
            else:
                typed[-1] = (text[:col], is_prompt)
        out.append(list(typed))
    for _ in range(14):          # hold on the finished frame
        out.append(list(typed))
    return out


def draw(state):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([10, 10, W - 10, H - 10], 12, fill=(15, 18, 22), outline=(35, 42, 51))
    d.rounded_rectangle([10, 10, W - 10, 44], 12, fill=BAR)
    for i, c in enumerate(((255, 95, 86), (255, 189, 46), (39, 201, 63))):
        d.ellipse([28 + i * 20, 21, 40 + i * 20, 33], fill=c)
    d.text((100, 21), "device-agent  —  every step on a hash chain", font=f, fill=DIM)

    visible = state[-(H - 60) // LH:]
    y = 56
    for i, (text, is_prompt) in enumerate(visible):
        base = list(visible)
        line = text
        col = PROMPT if is_prompt else colour(line)
        d.text((PAD, y), line, font=fb if is_prompt else f, fill=col)
        y += LH
    # cursor on the last line
    last = visible[-1][0] if visible else ""
    cx = PAD + int(len(last) * 8.42)
    d.rectangle([cx, y - LH + 2, cx + 8, y - LH + 16], fill=GREEN)
    return img


def main():
    fr = frames()
    imgs = []
    for st in fr:
        im = draw(st).convert("P", palette=Image.ADAPTIVE, colors=64)
        imgs.append(im)
    OUT_GIF.parent.mkdir(parents=True, exist_ok=True)
    imgs[0].save(OUT_GIF, save_all=True, append_images=imgs[1:], duration=80, loop=0, optimize=True)
    draw(fr[-1]).save(OUT_PNG)
    print(f"{OUT_GIF}  {len(fr)} frames  {OUT_GIF.stat().st_size/1024:.0f} KB")
    print(f"{OUT_PNG}  still frame")


if __name__ == "__main__":
    main()
