@echo off
title Clarity - Updating...

REM  "git pull" ci-dessous peut remplacer CE fichier. Or cmd relit un .bat ligne
REM  par ligne pendant qu'il tourne : remplace en cours de route, il reprendrait
REM  au meme octet du NOUVEAU fichier et executerait n'importe quoi. Le script se
REM  copie donc d'abord ailleurs et s'execute depuis la copie, que git ne touche pas.
if /i not "%~1"=="--depuis-copie" (
  copy /y "%~f0" "%TEMP%\clarity-update.bat" >nul
  "%TEMP%\clarity-update.bat" --depuis-copie "%~dp0."
  exit /b
)
cd /d "%~2"

REM  Met a jour les DEUX facons de lancer Clarity : la copie de developpement
REM  (start.bat, "Clarity (dev)") et l'application installee ("Clarity"). Avant,
REM  ce script ne mettait a jour que la premiere : l'app installee restait sur sa
REM  version d'origine, sans que rien ne le dise.
REM
REM  Ne detruit jamais rien. "git pull --ff-only" refuse au lieu d'ecraser quand
REM  la copie locale a diverge - ce script se lance en double-clic, sans le lire.

call :clarity_ferme || exit /b 1

echo.
echo  [1/4] Downloading latest updates...
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
echo  [2/4] Checking dependencies...
call npm install --no-audit --no-fund || goto :echec
call npx install-electron || goto :echec
pushd backend
call npm install --no-audit --no-fund
set ERR=%errorlevel%
popd
if not "%ERR%"=="0" goto :echec
pushd frontend
call npm install --no-audit --no-fund
set ERR=%errorlevel%
popd
if not "%ERR%"=="0" goto :echec

echo.
echo  [3/4] Building the installer (a few minutes)...
if exist dist-electron rmdir /s /q dist-electron
call npm run build || goto :echec

echo.
echo  [4/4] Updating the installed app...
set "INSTALLEUR="
for %%f in ("dist-electron\Clarity Setup *.exe") do set "INSTALLEUR=%%f"
if not defined INSTALLEUR goto :echec
start /wait "" "%INSTALLEUR%" /S
if errorlevel 1 goto :echec

echo.
echo  ============================================
echo   Clarity is up to date - both versions.
echo   Start it from the Desktop or the Start menu.
echo  ============================================
echo.
pause
exit /b 0

:echec
echo.
echo  ============================================
echo   Update stopped at the step above.
echo   Your tasks are safe: they live outside this
echo   folder and were not touched. Copy the last
echo   lines of this window and ask for help.
echo  ============================================
echo.
pause
exit /b 1

REM  Les deux versions doivent etre fermees : npm remplace des fichiers que la
REM  version dev utilise, et l'installeur remplace Clarity.exe.
:clarity_ferme
tasklist /fi "imagename eq Clarity.exe" 2>nul | find /i "Clarity.exe" >nul
if not errorlevel 1 goto :demander
tasklist /fi "imagename eq electron.exe" 2>nul | find /i "electron.exe" >nul
if not errorlevel 1 goto :demander
exit /b 0
:demander
echo.
echo  Clarity is open. Quit it first: right-click its icon
echo  near the clock, then Quit. Then press any key here.
pause >nul
goto :clarity_ferme
