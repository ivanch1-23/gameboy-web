# GAME BOY en el browser

Carcasa DMG, LCD verdoso, D-pad, boot splash, Tetris, Snake, carcasas temáticas y lector de ROMs `.gb` / `.gbc` (emulador [binjgb](https://github.com/binji/binjgb), MIT).

## Arranque

Desde la carpeta del repo (cualquier disco, C: o D:):

```bat
start.bat
```

o:

```bat
python server.py
```

Abrí [http://127.0.0.1:8765](http://127.0.0.1:8765).

## ROMs

En el panel izquierdo, junto a **Abrir archivo**, pegá la ruta de la carpeta donde bajaste los cartuchos (por ejemplo `C:\Roms` o `D:\juegos\gb`) y dale a **Usar ruta**. El servidor lista `.gb`, `.gbc` y `.zip` de esa carpeta.

También vale la carpeta `roms` del propio repo. No se incluye ninguna ROM comercial.

## Controles

- D-pad / WASD
- A: X o K
- B: Z o J
- START: Enter
- SELECT: Shift
- SELECT + START: volver al menú
