@echo off
title Central DXF CNC PRO - Servidor Local
echo ========================================================
echo   CENTRAL DXF CNC PRO - GERADOR DE ARQUIVOS DXF PARA CNC
echo   Versao Empresarial Local (100%% Ilimitada e Sem Custos)
echo ========================================================
echo.
echo Iniciando servidor local na porta 3000...
cd /d "%~dp0"
start "" http://localhost:3000
node server.js
pause
