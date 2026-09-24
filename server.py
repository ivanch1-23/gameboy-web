from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse
import json
import os
import sys
import zipfile

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)

CONFIG = ROOT / "rom-folder.json"
ROM_EXTS = {".gb", ".gbc", ".sgb", ".bin"}
ZIP_EXTS = {".zip"}
LOCAL_ROMS = ROOT / "roms"


def load_custom_folder():
    try:
        data = json.loads(CONFIG.read_text(encoding="utf-8"))
        path = Path(str(data.get("path") or "").strip().strip('"'))
        if path.is_dir():
            return path.resolve()
    except (OSError, json.JSONDecodeError, TypeError):
        pass
    return None


def save_custom_folder(path: Path):
    CONFIG.write_text(json.dumps({"path": str(path)}, indent=2), encoding="utf-8")


def scan_folders():
    folders = []
    if LOCAL_ROMS.is_dir():
        folders.append(LOCAL_ROMS.resolve())
    custom = load_custom_folder()
    if custom and custom not in folders:
        folders.append(custom)
    return folders


def is_under(path: Path, folder: Path):
    try:
        path.resolve().relative_to(folder.resolve())
        return True
    except ValueError:
        return False


def allowed_rom(path: Path):
    if not path.is_file():
        return False
    suffix = path.suffix.lower()
    if suffix in ROM_EXTS:
        return True
    if suffix in ZIP_EXTS:
        return zip_has_rom(path)
    return False


def zip_has_rom(path: Path):
    try:
        with zipfile.ZipFile(path) as zf:
            return any(Path(name).suffix.lower() in ROM_EXTS for name in zf.namelist())
    except (OSError, zipfile.BadZipFile):
        return False


def read_rom_bytes(path: Path):
    suffix = path.suffix.lower()
    if suffix in ROM_EXTS:
        return path.read_bytes()
    if suffix in ZIP_EXTS:
        with zipfile.ZipFile(path) as zf:
            names = [n for n in zf.namelist() if Path(n).suffix.lower() in ROM_EXTS]
            if not names:
                raise FileNotFoundError("zip without rom")
            return zf.read(names[0])
    raise FileNotFoundError("unsupported")


def list_roms():
    roms = []
    seen = set()
    for folder in scan_folders():
        try:
            files = sorted(folder.rglob("*"))
        except OSError:
            continue
        for path in files:
            if path.name.lower() == "readme.txt":
                continue
            if not allowed_rom(path):
                continue
            key = str(path.resolve()).lower()
            if key in seen:
                continue
            seen.add(key)
            roms.append(
                {
                    "name": path.name,
                    "size": path.stat().st_size,
                    "folder": str(folder),
                    "url": "/extrom?path=" + quote(str(path.resolve()), safe=""),
                }
            )
    return roms


def json_response(handler, payload, status=200):
    data = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(data)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(data)


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".wasm": "application/wasm",
        ".gb": "application/octet-stream",
        ".gbc": "application/octet-stream",
        ".zip": "application/zip",
    }

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def do_GET(self):
        if self.path == "/api/roms":
            custom = load_custom_folder()
            json_response(
                self,
                {
                    "roms": list_roms(),
                    "folders": [str(p) for p in scan_folders()],
                    "customPath": str(custom) if custom else "",
                },
            )
            return

        if self.path.startswith("/extrom?"):
            qs = parse_qs(urlparse(self.path).query)
            raw = unquote((qs.get("path") or [""])[0])
            path = Path(raw)
            allowed = any(is_under(path, folder) for folder in scan_folders())
            if not allowed or not allowed_rom(path):
                self.send_error(404, "ROM not found")
                return
            try:
                data = read_rom_bytes(path)
            except OSError:
                self.send_error(404, "ROM not found")
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/rom-folder":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            json_response(self, {"ok": False, "error": "JSON inválido"}, 400)
            return
        raw = str(body.get("path") or "").strip().strip('"')
        if not raw:
            save_custom_folder(LOCAL_ROMS)
            custom = load_custom_folder()
            json_response(
                self,
                {
                    "ok": True,
                    "customPath": str(custom) if custom else "",
                    "roms": list_roms(),
                    "folders": [str(p) for p in scan_folders()],
                },
            )
            return
        path = Path(raw).expanduser()
        if not path.is_dir():
            json_response(
                self,
                {"ok": False, "error": f"No existe esa carpeta: {path}"},
                400,
            )
            return
        save_custom_folder(path.resolve())
        json_response(
            self,
            {
                "ok": True,
                "customPath": str(path.resolve()),
                "roms": list_roms(),
                "folders": [str(p) for p in scan_folders()],
            },
        )


def main():
    port = int(os.environ.get("PORT", "8765"))
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"GAME BOY lista en http://127.0.0.1:{port}", flush=True)
    folders = scan_folders()
    print(
        "ROMs: "
        + (" | ".join(str(p) for p in folders) if folders else "(ninguna carpeta todavía)"),
        flush=True,
    )
    httpd.serve_forever()


if __name__ == "__main__":
    main()
