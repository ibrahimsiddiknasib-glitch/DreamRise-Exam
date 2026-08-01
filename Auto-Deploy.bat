@echo off
setlocal enabledelayedexpansion
color 0B
TITLE DreamRise Exam - Smart Setup Assistant

echo ===================================================
echo     DreamRise Exam Auto-Installer ^& Deployer
echo ===================================================
echo.

:: 1. Check & Install Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js is missing. This is required.
    set "installNode=N"
    set /p installNode="Install Node.js automatically? (Y/N): "
    if /i "!installNode!"=="Y" (
        echo [~] Installing Node.js via Winget...
        winget install OpenJS.NodeJS -e --source winget
        echo [+] Node.js installed! Please CLOSE this window and run deploy.bat again.
        pause & exit
    ) else (
        echo [-] Installation cancelled. Exiting...
        pause & exit
    )
)

:: 2. Check & Install Google Clasp
where clasp >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Google Clasp is missing.
    set "installClasp=N"
    set /p installClasp="Install Google Clasp automatically? (Y/N): "
    if /i "!installClasp!"=="Y" (
        echo [~] Installing Clasp globally...
        call npm install -g @google/clasp
    ) else (
        echo [-] Installation cancelled. Exiting...
        pause & exit
    )
)

:: 3. Setup Configuration
set CONFIG_FILE=dreamrise_config.txt
set "PROJECT_PATH=%cd%"

echo.
echo ===================================================
echo                PROJECT SETUP
echo ===================================================

if exist "%CONFIG_FILE%" (
    for /f "usebackq delims=" %%x in ("%CONFIG_FILE%") do (set "%%x")
    echo [+] Configuration Loaded:
    echo     Script ID : !SCRIPT_ID!
    echo ---------------------------------------------------
    set "changeScript=N"
    set /p changeScript="Do you want to enter a NEW Script ID? [Y/N, Default: N]: "
    
    if /i "!changeScript!"=="Y" (
        set /p SCRIPT_ID="Enter New Apps Script ID: "
        echo PROJECT_PATH=!PROJECT_PATH!> "%CONFIG_FILE%"
        echo SCRIPT_ID=!SCRIPT_ID!>> "%CONFIG_FILE%"
        echo [+] New Script ID saved!
    )
) else (
    echo [!] Initial Setup
    echo ---------------------------------------------------
    set /p SCRIPT_ID="Paste your Google Apps Script ID: "
    echo PROJECT_PATH=!PROJECT_PATH!> "%CONFIG_FILE%"
    echo SCRIPT_ID=!SCRIPT_ID!>> "%CONFIG_FILE%"
    echo [+] Saved successfully!
)

cd /d "!PROJECT_PATH!"

:: 4. Generate Required Files safely
echo.
echo [~] Configuring project files...

echo {"scriptId":"!SCRIPT_ID!","rootDir":"."} > .clasp.json

if not exist "appsscript.json" (
    echo {"timeZone": "Asia/Dhaka","dependencies": {},"exceptionLogging": "STACKDRIVER","runtimeVersion": "V8"} > appsscript.json
    echo [+] Created missing appsscript.json
)

:: Strict Whitelist for Google Apps Script
echo **/** > .claspignore
echo !code.js >> .claspignore
echo !code.gs >> .claspignore
echo !SetupUI.html >> .claspignore
echo !webapp.html >> .claspignore
echo !appsscript.json >> .claspignore
echo [+] Created strict .claspignore (Whitelisted required files only)

:: 5. Login & Push
echo.
set "doLogin=N"
set /p doLogin="Do you need to login to Google Clasp? [Y/N, Default: N]: "
if /i "!doLogin!"=="Y" (
    call clasp login
)

echo.
echo [~] Deploying files to Google Apps Script...
call clasp push --force

echo.
echo ===================================================
if %errorlevel% equ 0 (
    echo    SUCCESS! Code pushed perfectly.
) else (
    echo    [!] FAILED! Please check your code for syntax errors.
)
echo ===================================================
pause
