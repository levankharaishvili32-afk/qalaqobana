@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js ar aris dayenebuli. Chamotvirtet: https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo Biblioteqebis chamotvirtva, 1-2 tsuti...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo Instalacia ver dasrulda. Sheamotsmet, rom saqaghaldis misamarti mokle iyos, mag. C:\qalaqobana
    pause
    exit /b 1
  )
)

echo.
echo Tamashi eshveba. Gakhsenit brauzershi: http://localhost:3000
echo Gasatishad dakhuret es fanjara.
echo.
call npm run play
pause
