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

REM  Rien de neuf depuis la derniere installation reussie : on s'arrete la. Sans
REM  ce test, chaque lancement reconstruisait et reinstallait tout - plusieurs
REM  minutes - meme quand "git pull" venait de dire "Already up to date".
REM  Pour forcer quand meme une reinstallation : supprimer .version-installee.
for /f %%h in ('git rev-parse HEAD') do set "VERSION=%%h"
set "DEJA="
if exist ".version-installee" set /p DEJA=<".version-installee"
if "%DEJA%"=="%VERSION%" (
  echo.
  echo  ============================================
  echo   Nothing new - Clarity is already up to date.
  echo  ============================================
  echo.
  pause
  exit /b 0
)

REM  Fermer Clarity seulement maintenant, quand il y a vraiment quelque chose a
REM  installer : git pull ne touche pas a ce que l'app ouverte verrouille.
call :clarity_ferme || exit /b 1

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
REM  "npm run package", PAS "npm run build". build reconstruit d'abord
REM  frontend/dist/ - un dossier VERSIONNE, deja verifie par la CI. Sous Windows,
REM  la reconstruction ne rend pas exactement les octets commites : le dossier
REM  devenait "modifie", et le git pull suivant qui touchait dist/ etait refuse
REM  ("Your local changes ... would be overwritten"). Une mise a jour ne doit
REM  jamais regenerer un fichier versionne : on empaquette dist/ tel quel.
if exist dist-electron rmdir /s /q dist-electron
call npm run package || goto :echec

echo.
echo  [4/4] Updating the installed app...
set "INSTALLEUR="
for %%f in ("dist-electron\Clarity Setup *.exe") do set "INSTALLEUR=%%f"
if not defined INSTALLEUR goto :echec
start /wait "" "%INSTALLEUR%" /S
if errorlevel 1 goto :echec
>".version-installee" echo %VERSION%

REM  Garde-fou : une mise a jour ne doit laisser AUCUN fichier suivi modifie,
REM  sinon le prochain git pull sera refuse. Si ca arrive, le dire maintenant -
REM  plutot que de le decouvrir a la prochaine mise a jour.
set "SALE="
for /f %%l in ('git status --porcelain --untracked-files=no') do set "SALE=1"
if defined SALE (
  echo.
  echo  Warning: this update left changes in files tracked by git:
  git status --short --untracked-files=no
  echo  The next update may refuse to start. Copy these lines and ask for help.
)

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
