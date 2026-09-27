# GAME BOY PWA

Emulador de Game Boy **100% en el cliente** (WebAssembly). Tetris, Snake, carcasas y ROMs `.gb` / `.gbc` que vos subís; se guardan en **IndexedDB** de tu navegador.

El `server.py` local **no emula ni guarda partidas**: solo sirve archivos estáticos para probar en tu PC.

## Correr en local

Python 3:

```bat
start.bat
```

o `python server.py` y abrí http://127.0.0.1:8765

## Auditoría (qué era el backend)

| Pieza | Dónde corre |
| --- | --- |
| CPU/PPU/APU Game Boy | `vendor/binjgb` (WASM) en el navegador |
| Tetris / Snake / UI | JavaScript |
| Lista de ROMs y SRAM | IndexedDB |
| Carcasa / tamaño | `localStorage` |
| Python | opcional, HTTP estático |

En internet **no hace falta Python**. Un sitio no puede leer `C:\` ni `D:\`; por eso Examinar / Abrir archivo copian la ROM a IndexedDB.

## PWA

- `manifest.webmanifest` — `display: standalone`
- `sw.js` — cache-first del core (HTML/JS/CSS/WASM) para offline
- Botón **Instalar app** cuando el navegador dispara `beforeinstallprompt`

## Hosting: Cloudflare Pages (recomendado)

Es estático: no hay cold start de un dyno Python (Render), el WASM se sirve desde CDN, el plan gratis aguanta bien este tamaño, y el deploy es git push.

**Por qué no las otras (para este repo):**

- **Render**: pensado para procesos; un `python server.py` se duerme y tarda en despertar.
- **Vercel / Netlify**: también sirven para estático; Cloudflare Pages suele ser igual de simple y el `_headers` para `.wasm` es directo.

### Paso a paso

1. Subí el repo a GitHub (ya: `ivanch1-23/gameboy-web`).
2. Entrá a [Cloudflare Pages](https://pages.cloudflare.com/) con una cuenta gratis.
3. **Create project** → **Connect to Git** → elegí `gameboy-web`.
4. Build: **Framework preset = None**. **Build command** vacío. **Output directory** = `/` (raíz del repo).
5. Deploy. La URL queda tipo `https://gameboy-web.pages.dev`.
6. HTTPS viene incluido (hace falta para Service Worker e instalar PWA).

El archivo `_headers` ya declara `Content-Type: application/wasm`.

No incluyas ROMs comerciales en el repo.

## Controles

D-pad / WASD · A = X/K · B = Z/J · START = Enter · SELECT = Shift · SELECT+START = menú
