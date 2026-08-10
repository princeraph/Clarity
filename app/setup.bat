@echo off
title Clarity — Setup
echo.
echo  Setting up Clarity...
echo.

cd /d "%USERPROFILE%\Personal-Work\clarity"

echo  [1/4] Installing Electron...
call npm install
echo.

echo  [2/4] Installing backend...
cd backend
call npm install
cd ..
echo.

echo  [3/4] Installing frontend...
cd frontend
call npm install
echo.

echo  [4/4] Building frontend...
call npm run build
cd ..
echo.

echo  [5/5] Generating app icon + desktop shortcut...
node scripts/generate-icon.js
powershell -ExecutionPolicy Bypass -File "%~dp0Create-Desktop-Shortcut.ps1"
echo.

echo  ============================================
echo   Setup complete!
echo   A Clarity shortcut has been added to your
echo   Desktop. Double-click it to launch Clarity.
echo  ============================================
echo.
pause
