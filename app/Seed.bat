@echo off
title Clarity — Load Sample Tasks

set DEST=%APPDATA%\Clarity\data
mkdir "%DEST%" 2>nul

echo.
echo  Loading sample tasks into Clarity...

copy /y "%USERPROFILE%\Personal-Work\clarity\backend\data\seed-tasks.json" "%DEST%\tasks.json" >nul

echo.
echo  ============================================
echo   Done! Launch Clarity to see the tasks.
echo   (This will overwrite any existing tasks)
echo  ============================================
echo.
pause
