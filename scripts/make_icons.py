"""Write simple DMG-green PNG icons without third-party deps."""
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1] / "icons"
ROOT.mkdir(exist_ok=True)


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, size: int) -> None:
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            nx = x / (size - 1)
            ny = y / (size - 1)
            inset = 0.08 < nx < 0.92 and 0.06 < ny < 0.94
            screen = 0.22 < nx < 0.78 and 0.16 < ny < 0.52
            if screen:
                row += bytes([15, 56, 15, 255])
            elif inset:
                g = int(180 + 40 * (1 - ny))
                row += bytes([g, min(210, g + 12), 46, 255])
            else:
                row += bytes([26, 20, 12, 255])
        rows.append(bytes(row))
    raw = b"".join(rows)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


if __name__ == "__main__":
    write_png(ROOT / "icon-192.png", 192)
    write_png(ROOT / "icon-512.png", 512)
    print("ok", ROOT)
