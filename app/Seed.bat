@echo off
setlocal enabledelayedexpansion
title Clarity - Load Sample Tasks

set "SRC=%USERPROFILE%\Personal-Work\projet-clarity\app\backend\data\seed-tasks.json"
set "DEST=%APPDATA%\Clarity\data"
set "TASKS=%DEST%\tasks.json"

REM Only used to name the backup. If PowerShell is unavailable the fallback
REM below keeps the script working rather than letting it fail on a filename.
for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd-HHmmss" 2^>nul') do set "STAMP=%%T"
if not defined STAMP set "STAMP=before-seed"

echo.
echo  Clarity - load sample tasks
echo.

REM A copy that copied nothing used to print "Done!" all the same: the old
REM version sent the copy's output to nul and never looked at its exit code.
REM A wrong path therefore looked exactly like a success.
if not exist "%SRC%" (
  echo  ERROR: the sample file is missing.
  echo         expected at %SRC%
  echo.
  echo  Nothing was changed.
  echo.
  pause
  exit /b 1
)

if not exist "%DEST%" mkdir "%DEST%" 2>nul

REM Ask BEFORE destroying. The old version printed "this will overwrite any
REM existing tasks" underneath the copy that had already overwritten them.
if exist "%TASKS%" (
  for %%F in ("%TASKS%") do (
    echo  You already have tasks in Clarity:
    echo         %TASKS%
    echo         last changed %%~tF, %%~zF bytes
  )
  echo.
  echo  Loading the samples REPLACES them.
  echo  A copy is saved first, so this can be undone.
  echo.
  set "ANSWER="
  set /p "ANSWER=  Type YES to replace your tasks, anything else cancels: "
  if /i not "!ANSWER!"=="YES" (
    echo.
    echo  Cancelled - nothing was changed.
    echo.
    pause
    exit /b 0
  )

  set "SAVED=%DEST%\tasks-before-seed-!STAMP!.json"
  copy /y "%TASKS%" "!SAVED!" >nul
  REM If the copy that protects the tasks fails, the one that destroys them
  REM must not run.
  if errorlevel 1 (
    echo.
    echo  ERROR: could not save a copy of your tasks. Stopping here.
    echo  Nothing was changed.
    echo.
    pause
    exit /b 1
  )
  echo.
  echo  Your tasks were saved to:
  echo         !SAVED!
)

copy /y "%SRC%" "%TASKS%" >nul
if errorlevel 1 (
  echo.
  echo  ERROR: the copy failed. Your tasks were NOT replaced.
  echo.
  pause
  exit /b 1
)

echo.
echo  ============================================
echo   Done - 8 sample tasks loaded.
echo   Restart Clarity to see them.
echo  ============================================
echo.
echo  Note: sample tasks carry no timing or history,
echo  so the Patterns page stays empty while they are
echo  loaded. Clear them before using Clarity for real.
echo.
pause
