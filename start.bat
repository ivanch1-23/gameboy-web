@echo off
cd /d D:\gameboy-browser
echo Abriendo GAME BOY en http://127.0.0.1:8765
start "" "http://127.0.0.1:8765"
python server.py
pause
