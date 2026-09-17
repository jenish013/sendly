@echo off
cd /d D:\sendly
call stop-dev.bat nopause
timeout /t 2 /nobreak >nul
echo.
echo Restarting SENDLY development environment...
call start-dev.bat
