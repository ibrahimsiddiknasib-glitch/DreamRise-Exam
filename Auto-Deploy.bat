@echo off
setlocal enabledelayedexpansion
color 0A
TITLE DreamRise Exam - Auto Deployer

echo ===================================================
echo      DreamRise Exam - Auto Setup ^& Deploy
echo ===================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js is missing. Installing...
    winget install OpenJS.NodeJS -e --source winget
    echo [+] Node.js installed! Please close and reopen this window.
    pause & exit
)

:: 2. Check Clasp
where clasp >nul 2>nul
if %errorlevel% neq 0 (
    echo [~] Installing Google Clasp...
    call npm install -g @google/clasp
)

:: 3. Setup Configuration
set CONFIG_FILE=dreamrise_config.txt

if exist "%CONFIG_FILE%" (
    echo [+] Configuration loaded automatically!
    for /f "usebackq delims=" %%x in ("%CONFIG_FILE%") do (set "%%x")
) else (
    echo [!] STEP 1/2: Folder Location
    echo ---------------------------------------------------
    echo Just press ENTER to use current folder.
    echo ---------------------------------------------------
    set "PROJECT_PATH="
    set /p PROJECT_PATH="Project Path [Press ENTER for Current]: "
    
    if "!PROJECT_PATH!"=="" set "PROJECT_PATH=%cd%"

    echo.
    echo [!] STEP 2/2: Apps Script ID
    echo ---------------------------------------------------
    echo Paste your Google Apps Script ID below.
    echo ---------------------------------------------------
    set /p SCRIPT_ID="Apps Script ID: "
    
    echo PROJECT_PATH=!PROJECT_PATH!> "%CONFIG_FILE%"
    echo SCRIPT_ID=!SCRIPT_ID!>> "%CONFIG_FILE%"
    echo.
    echo [+] Saved successfully!
)

cd /d "!PROJECT_PATH!"
echo.

:: 4. Google Login
echo [!] Google Clasp Login
echo ---------------------------------------------------
echo Type Y to open browser login, or press ENTER to skip.
echo ---------------------------------------------------
set "doLogin=N"
set /p doLogin="Login now? [Y/N, Default: N]: "
if /i "!doLogin!"=="Y" (
    call clasp login
)

:: 5. Deployment
echo.
echo [~] Deploying code to Google Apps Script...
if not exist ".clasp.json" (
    call clasp clone !SCRIPT_ID!
)

call clasp push

echo.
echo ===================================================
echo    SUCCESS! Deployment completed.
echo ===================================================
pause
