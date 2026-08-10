@echo off
title Clarity — Updating...
cd /d "%USERPROFILE%\Personal-Work"

echo.
echo  Downloading latest updates...
echo.

git fetch origin claude/project-organization-app-wYkaf

git reset --hard origin/claude/project-organization-app-wYkaf

echo.
echo  Checking dependencies...
cd clarity\backend
call npm install --silent
cd ..\..

echo.
echo  ============================================
echo   Clarity is up to date!
echo   You can close this window and launch the app.
echo  ============================================
echo.
pause
