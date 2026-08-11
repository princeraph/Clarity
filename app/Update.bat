@echo off
title Clarity — Updating...
cd /d "%USERPROFILE%\Personal-Work"

echo.
echo  Downloading latest updates...
echo.

git fetch origin main
git pull --ff-only origin main

if errorlevel 1 (
  echo.
  echo  ============================================
  echo   Update stopped - nothing was changed.
  echo.
  echo   Your copy has local edits that do not match
  echo   the latest version. No files were touched,
  echo   so nothing is lost. Ask before retrying.
  echo  ============================================
  echo.
  pause
  exit /b 1
)

echo.
echo  Checking dependencies...
cd /d "%USERPROFILE%\Personal-Work\projet-clarity\app\backend"
call npm install --silent

echo.
echo  ============================================
echo   Clarity is up to date!
echo   You can close this window and launch the app.
echo  ============================================
echo.
pause
