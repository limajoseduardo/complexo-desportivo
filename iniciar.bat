@echo off
title Complexo Desportivo - Servidor

:: Abrir porta 3100 na firewall (requer admin)
netsh advfirewall firewall show rule name="Vite Dev 3100" >nul 2>&1
if errorlevel 1 (
    powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList 'netsh advfirewall firewall add rule name=''Vite Dev 3100'' dir=in action=allow protocol=TCP localport=3100 profile=domain,private,public' -Wait"
)

set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"
echo.
echo  ==========================================
echo   COMPLEXO DESPORTIVO
echo   Local:  http://localhost:3100
echo   Rede:   http://192.168.9.40:3100
echo  ==========================================
echo.
node_modules\.bin\vite.cmd --port=3100 --host=0.0.0.0
pause
