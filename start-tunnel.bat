@echo off
setlocal enabledelayedexpansion

cd /d D:\sendly

REM Cleanup previous tunnel state
del /q .tunnel-output.log 2>nul >nul

set "CLOUDFARED_EXE=%TEMP%\cloudflared.exe"
if not exist "!CLOUDFARED_EXE!" (
    echo ERROR:
    echo cloudflared.exe was not found.
    echo Expected: %TEMP%\cloudflared.exe
    echo Download from: https://github.com/cloudflare/cloudflared/releases
    pause
    exit /b 1
)

echo Checking prerequisites...
where node >nul 2>nul
if !ERRORLEVEL! neq 0 (
    echo ERROR: Node.js not found.
    pause
    exit /b 1
)

echo Checking backend health...
curl -s http://localhost:5000/ >nul 2>nul
if !ERRORLEVEL! neq 0 (
    echo ERROR: Backend is not running at http://localhost:5000/
    echo Start the full environment first: start-dev.bat
    pause
    exit /b 1
)

echo Checking frontend health...
curl -s http://localhost:5173/ >nul 2>nul
if !ERRORLEVEL! neq 0 (
    echo ERROR: Frontend is not running at http://localhost:5173/
    echo Start the full environment first: start-dev.bat
    pause
    exit /b 1
)

echo.
echo Backend:   http://localhost:5000 ✓
echo Frontend:  http://localhost:5173 ✓
echo.
echo Starting Cloudflare Tunnel (tunnel-only mode)...
echo Press Ctrl+C to stop the tunnel.
echo.

start "SENDLY Tunnel" cmd /c "\"!CLOUDFARED_EXE!\" tunnel --url http://localhost:5173 >> .tunnel-output.log 2>&1"

REM Wait for tunnel URL
set /a count=0
:wait_tunnel
timeout /t 1 /nobreak >nul
set /a count+=1

if exist ".tunnel-output.log" (
    for /f "delims=" %%a in ('powershell -NoProfile -Command "try { $content = Get-Content '.tunnel-output.log' -Raw -ErrorAction SilentlyContinue; if ($content -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $matches[0] } } catch {}"' 2^>nul') do set "TUNNEL_URL=%%a"
    
    if defined TUNNEL_URL (
        echo Cloudflare Tunnel started ✓
        echo.
        echo ========================================
        echo         SENDLY PUBLIC URL
        echo ========================================
        echo.
        echo   !TUNNEL_URL!
        echo.
        echo ========================================
        echo.
        echo Open this URL on your phone (switch to mobile data):
        echo   !TUNNEL_URL!
        echo ========================================
        echo.
        echo Opening browser...
        start "" "!TUNNEL_URL!"
        echo.
        echo SENDLY READY ✓
        pause
        exit /b 0
    )
)

if !count! gtr 45 (
    echo WARNING: Tunnel URL not detected within 45 seconds.
    echo Check .tunnel-output.log for details.
    pause
    exit /b 0
)
goto :wait_tunnel
