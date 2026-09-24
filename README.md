# GAME BOY en el browser

Carcasa DMG verde, LCD verdoso, D-pad, boot splash, Tetris, Snake y lector de ROMs `.gb` / `.gbc` (emulador [binjgb](https://github.com/binji/binjgb), MIT).

Todo vive en `D:\gameboy-browser`.

## Arranque

```bat
D:\gameboy-browser\start.bat
```

o:

```bat
python D:\gameboy-browser\server.py
```

Abrí [http://127.0.0.1:8765](http://127.0.0.1:8765).

## ROMs

Copiá cartuchos legalmente obtenidos a:

- `D:\gameboy-browser\roms`
- `D:\roms`
- `D:\ROMs`
- `D:\Games\Game Boy`

El servidor las lista en `/api/roms`. También podés abrir un archivo a mano.

No se incluye ninguna ROM comercial.

## Controles

- D-pad / WASD
- A: X o K
- B: Z o J
- START: Enter
- SELECT: Shift
- SELECT + START: volver al menú
