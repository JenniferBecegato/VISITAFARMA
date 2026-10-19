R@echo off
cd /d "%~dp0campos-visitas"
echo Iniciando VISITAFARMA em http://127.0.0.1:4173/
echo Aguarde a compilacao. Mantenha esta janela aberta durante o uso.
echo Se a porta estiver ocupada, encerre o servidor anterior com Ctrl+C.
call npm.cmd start
pause
