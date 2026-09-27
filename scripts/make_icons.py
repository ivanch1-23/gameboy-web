"""Resize PWA icons from icons/icon-source.png (Pillow)."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "icons"
SOURCE = ROOT / "icon-source.png"


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"missing {SOURCE}")
    img = Image.open(SOURCE).convert("RGBA")
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    for size, name in ((180, "icon-180.png"), (192, "icon-192.png"), (512, "icon-512.png")):
        img.resize((size, size), Image.Resampling.LANCZOS).save(ROOT / name, optimize=True)
    print("ok", ROOT)


if __name__ == "__main__":
    main()
