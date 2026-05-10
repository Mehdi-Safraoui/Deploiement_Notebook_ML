@echo off
title Amazon Sales Dashboard

echo.
echo  ============================================
echo   Amazon Sales Dashboard -- Demarrage local
echo  ============================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Python n'est pas installe ou pas dans le PATH.
    pause & exit /b 1
)

:: Check Node
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Node.js n'est pas installe ou pas dans le PATH.
    pause & exit /b 1
)

:: Install Python dependencies
echo [1/4] Installation des dependances Python...
cd /d "%~dp0"
pip install -r api\requirements.txt --quiet
if errorlevel 1 (
    echo [ERREUR] pip install a echoue.
    pause & exit /b 1
)
echo       OK

:: Install Node dependencies
echo [2/4] Installation des dependances Node...
npm install --silent
if errorlevel 1 (
    echo [ERREUR] npm install a echoue.
    pause & exit /b 1
)
echo       OK

:: Start Python Flask API
echo [3/4] Demarrage de l'API Python (port 5000)...
start "Python ML API" cmd /k "cd /d "%~dp0" && python api\app.py"
timeout /t 3 /nobreak >nul

:: Start Express server
echo [4/4] Demarrage du serveur Express (port 3000)...
start "Express Dashboard" cmd /k "cd /d "%~dp0" && node server.js"
timeout /t 2 /nobreak >nul

:: Open browser
echo.
echo  Dashboard disponible sur : http://localhost:3000
echo.
start http://localhost:3000

echo  Les deux serveurs tournent dans leurs fenetres separees.
echo  Fermez ces fenetres pour arreter les serveurs.
echo.
pause
