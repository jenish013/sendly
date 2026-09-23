@echo off
setlocal

echo Stopping SENDLY development services...

REM Stop services by window title (created by start-dev.bat)
taskkill /F /T /FI "WINDOWTITLE eq SENDLY Backend" >nul 2>nul
taskkill /F /T /FI "WINDOWTITLE eq SENDLY Frontend" >nul 2>nul
taskkill /F /T /FI "WINDOWTITLE eq SENDLY Tunnel" >nul 2>nul

REM Kill any lingering cloudflared processes
taskkill /F /IM cloudflared.exe >nul 2>nul
taskkill /F /IM cloudflared-windows-amd64.exe >nul 2>nul

REM Clean up temp files
del /q "%~dp0.tunnel-output.log" 2>nul >nul
del /q "%~dp0.tunnel-url.txt" 2>nul >nul

echo.
echo All SENDLY services stopped.
if /i "%~1"=="nopause" exit /b 0

echo.
pause
exit /b 0
