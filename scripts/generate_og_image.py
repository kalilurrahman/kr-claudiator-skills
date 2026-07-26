#!/usr/bin/env python3
"""Generate the self-hosted Open Graph card (public/og.png, 1200x630).

Replaces the previously used third-party signed URL (which expired and broke
social sharing cards). Re-run after changing the headline skill count.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "og.png"
W, H = 1200, 630

BG = (11, 15, 26)          # deep slate
PANEL = (17, 24, 39)       # slightly lighter card
ACCENT_A = (129, 90, 246)  # violet
ACCENT_B = (56, 132, 255)  # blue
TEXT = (237, 240, 247)
MUTED = (148, 158, 178)

BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
BOOK = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def main():
    total = json.loads((ROOT / "public" / "data" / "skills-data.json").read_text())[
        "totalSkills"
    ]

    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # top accent bar: horizontal violet->blue gradient
    for x in range(W):
        d.line([(x, 0), (x, 10)], fill=lerp(ACCENT_A, ACCENT_B, x / W))

    # faint dot grid for texture
    for gx in range(60, W, 60):
        for gy in range(70, H, 60):
            d.ellipse([gx, gy, gx + 2, gy + 2], fill=(30, 38, 56))

    # wordmark
    d.text((80, 150), "Claudiator", font=ImageFont.truetype(BOLD, 108), fill=TEXT)
    # gradient underline under the wordmark
    for x in range(80, 660):
        d.line([(x, 285), (x, 291)], fill=lerp(ACCENT_A, ACCENT_B, (x - 80) / 580))

    d.text(
        (82, 330),
        f"The Claude Skills Library — {total}+ production-ready",
        font=ImageFont.truetype(BOOK, 40),
        fill=MUTED,
    )
    d.text(
        (82, 385),
        "SKILL.md playbooks for Claude Code & Cowork",
        font=ImageFont.truetype(BOOK, 40),
        fill=MUTED,
    )

    # category chips
    chips = ["Software Dev", "DevOps", "AI / ML", "Security", "System Design", "PM"]
    chip_font = ImageFont.truetype(BOOK, 26)
    x = 82
    for chip in chips:
        w = d.textlength(chip, font=chip_font)
        d.rounded_rectangle([x, 470, x + w + 36, 516], radius=23, fill=PANEL,
                            outline=(45, 56, 82), width=2)
        d.text((x + 18, 479), chip, font=chip_font, fill=TEXT)
        x += w + 52

    d.text(
        (82, 560),
        "claudiator.kalilurrahman.com",
        font=ImageFont.truetype(BOLD, 30),
        fill=lerp(ACCENT_A, ACCENT_B, 0.5),
    )

    img.save(OUT, optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
