@echo off
title Clarity — Setup
echo.
echo  Setting up Clarity...
echo.

cd /d "%~dp0"

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
cd ..
echo.

REM  Pas de "npm run build" ici. frontend/dist/ est VERSIONNE : CLAUDE.md dit
REM  que l'app tourne depuis un clone nu, sans etape de build, et la CI verifie
REM  a chaque push que dist/ correspond bien aux sources. Le reconstruire a
REM  l'installation ne produit donc rien de neuf - mais il SALIT un dossier
REM  suivi par git, et le prochain "git pull" est refuse :
REM      error: Your local changes to the following files would be overwritten
REM             app/frontend/dist/index.html
REM  Une installation ne doit jamais rendre un depot impossible a mettre a jour.
REM  Qui modifie frontend/src/ reconstruit avec "npm run build:frontend" et
REM  commite dist/ dans le meme commit - c'est la regle, et c'est autre chose
REM  qu'installer.

echo  [4/4] Creating desktop shortcut...
REM  Pas d'appel a generate-icon.js ici. build/icon.ico et build/icon.png sont
REM  VERSIONNES, comme frontend/dist/ : un clone les a deja. Le script les
REM  regenerait donc par-dessus des fichiers corrects, via rsvg-convert, qui
REM  n'existe pas sous Windows - la plateforme principale de cette app. Chaque
REM  installation affichait une erreur rouge conseillant "apt-get install",
REM  puis "Setup complete!" juste apres. Rien n'etait casse, mais rien ne le
REM  disait. Create-Desktop-Shortcut.ps1 sait deja generer l'icone si elle
REM  manque, et se rabattre proprement sinon : c'est le seul endroit qui en a
REM  besoin. generate-icon.js reste un outil de maintenance, a lancer a la main
REM  quand la marque change.
powershell -ExecutionPolicy Bypass -File "%~dp0Create-Desktop-Shortcut.ps1"
echo.

echo  ============================================
echo   Setup complete!
echo   A Clarity shortcut has been added to your
echo   Desktop. Double-click it to launch Clarity.
echo  ============================================
echo.
pause
