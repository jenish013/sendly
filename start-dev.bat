@echo off
setlocal enabledelayedexpansion

set "PROJECT_DIR=D:\sendly"
cd /d "%PROJECT_DIR%"

REM Cleanup previous state
del /q .tunnel-output.log 2>nul >nul
del /q .tunnel-url.txt 2>nul >nul

REM Check prerequisites
call :check_prerequisites
if !ERRORLEVEL! neq 0 (
    pause
    exit /b 1
)

echo.
echo Starting SENDLY development environment...
echo.

REM Start backend
echo Starting backend...
start "SENDLY Backend" cmd /c "cd /d backend && npm run dev"

REM Start frontend
echo Starting frontend...
start "SENDLY Frontend" cmd /c "npm run dev"

REM Wait for services to be ready
echo Waiting for services to initialize...
call :wait_for_backend
call :wait_for_frontend

echo.
echo Backend started ✓
echo Frontend started ✓

REM Start Cloudflare Tunnel
echo.
echo Starting Cloudflare Tunnel...
start "SENDLY Tunnel" cmd /c "\"%TEMP%\cloudflared.exe\" tunnel --url http://localhost:5173 >> .tunnel-output.log 2>&1"

REM Wait for tunnel URL
echo Detecting tunnel URL...
call :wait_for_tunnel_url

cls
echo.
echo ========================================
echo         SENDLY DEVELOPMENT SERVER
echo =========================================
echo.
echo Frontend:
echo   http://localhost:5173
echo.
echo Backend:
echo   http://localhost:5000
echo.
if defined TUNNEL_URL (
echo Public URL:
echo   !TUNNEL_URL!
echo.
echo ========================================
echo Open this URL on your phone:
echo   !TUNNEL_URL!
echo ========================================
) else (
echo Public URL:
echo   (Tunnel not available - local only)
echo.
echo Tip: Start the tunnel manually to enable public access
echo)

echo.
echo To stop all services:  stop-dev.bat
echo ========================================
echo.
if defined TUNNEL_URL (
    echo Opening browser at !TUNNEL_URL!
    start "" "!TUNNEL_URL!"
) else (
    echo Opening browser at http://localhost:5173
    start "" "http://localhost:5173"
)
echo.
echo SENDLY READY ✓
echo Press any key to close this monitor (services continue in background)
pause >nul
exit /b 0

:check_prerequisites
where node >nul 2>nul
if !ERRORLEVEL! neq 0 (
    echo ERROR: Node.js not found. Please install Node.js and npm.
    exit /b 1
)
where npm >nul 2>nul
if !ERRORLEVEL! neq 0 (
    echo ERROR: npm not found. Please install Node.js and npm.
    exit /b 1
)
set "CLOUDFARED_EXE=%TEMP%\cloudflared.exe"
if not exist "!CLOUDFARED_EXE!" (
    echo ERROR:
    echo cloudflared.exe was not found.
    echo Expected: %TEMP%\cloudflared.exe
    echo Download from: https://github.com/cloudflare/cloudflared/releases
    exit /b 1
)
echo Prerequisites check passed:
echo   Node.js: 
where node
echo   npm:
where npm
echo   cloudflared: 
"!CLOUDFARED_EXE!" version
exit /b 0

:wait_for_backend
set /a count=0
:check_b_loop
curl -s http://localhost:5000/ >nul 2>nul
if !ERRORLEVEL! equ 0 exit /b 0
set /a count+=1
if !count! gtr 60 (
    echo WARNING: Backend not responding after 60 seconds
    exit /b 1
)
timeout /t 1 /nobreak >nul
goto :check_b_loop

:wait_for_frontend
set /a count=0
:check_f_loop
curl -s http://localhost:5173/ >nul 2>nul
if !ERRORLEVEL! equ 0 exit /b 0
set /a count+=1
if !count! gtr 60 (
    echo WARNING: Frontend not responding after 60 seconds
    exit /b 1
)
timeout /t 1 /nobreak >nul
goto :check_f_loop

:wait_for_tunnel_url
set /a count=0
:check_t_loop
if exist ".tunnel-output.log" (
    for /f "delims=" %%a in ('powershell -NoProfile -Command "try { $content = Get-Content '.tunnel-output.log' -Raw -ErrorAction SilentlyContinue; if ($content -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $matches[0] } } catch {}"' 2^>nul') do set "TUNNEL_URL=%%a"
    if defined TUNNEL_URL (
        echo Cloudflare Tunnel started ✓
        exit /b 0
    )
)
set /a count+=1
if !count! gtr 45 (
    echo WARNING: Tunnel URL not detected within 45 seconds.
    echo Check .tunnel-output.log for details.
    echo Tunnel may still be starting or failed to connect.
    exit /b 0
)
timeout /t 1 /nobreak >nul
goto :check_t_loop
