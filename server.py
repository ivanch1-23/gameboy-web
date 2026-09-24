from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import sys

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)

ROM_EXTS = {".gb", ".gbc", ".sgb", ".bin"}
FOLDERS = [
    ROOT / "roms",
    Path("D:/roms"),
    Path("D:/ROMs"),
    Path("D:/Games/Game Boy"),
    Path("D:/Games/GB"),
]


def existing_folders():
    found = []
    for folder in FOLDERS:
        try:
            if folder.is_dir():
                found.append(folder)
        except OSError:
            continue
    return found


def list_roms():
    roms = []
    seen = set()
    for folder in existing_folders():
        try:
            files = sorted(folder.rglob("*"))
        except OSError:
            continue
        for path in files:
            if not path.is_file():
                continue
            if path.suffix.lower() not in ROM_EXTS:
                continue
            if path.name.lower() == "readme.txt":
                continue
            key = str(path.resolve()).lower()
            if key in seen:
                continue
            seen.add(key)
            rel = path.relative_to(ROOT) if ROOT in path.parents or path.parent == ROOT else None
            if rel is not None:
                url = "/" + rel.as_posix()
            else:
                url = "/extrom?path=" + str(path)
            roms.append(
                {
                    "name": path.name,
                    "size": path.stat().st_size,
                    "folder": str(folder),
                    "url": url,
                }
            )
    return roms


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".wasm": "application/wasm",
        ".gb": "application/octet-stream",
        ".gbc": "application/octet-stream",
    }

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def do_GET(self):
        if self.path == "/api/roms":
            payload = {
                "roms": list_roms(),
                "folders": [str(p) for p in existing_folders()],
            }
            data = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
            return

        if self.path.startswith("/extrom?"):
            from urllib.parse import parse_qs, urlparse

            qs = parse_qs(urlparse(self.path).query)
            raw = (qs.get("path") or [""])[0]
            path = Path(raw)
            allowed = False
            for folder in existing_folders():
                try:
                    path.resolve().relative_to(folder.resolve())
                    allowed = True
                    break
                except ValueError:
                    continue
            if not allowed or not path.is_file() or path.suffix.lower() not in ROM_EXTS:
                self.send_error(404, "ROM not found")
                return
            data = path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        return super().do_GET()


def main():
    port = int(os.environ.get("PORT", "8765"))
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"GAME BOY lista en http://127.0.0.1:{port}", flush=True)
    folders = existing_folders()
    print(
        "ROMs: "
        + (" | ".join(str(p) for p in folders) if folders else "(ninguna carpeta todavía)")
    )
    httpd.serve_forever()


if __name__ == "__main__":
    main()
