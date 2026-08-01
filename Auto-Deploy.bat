@echo off
setlocal enabledelayedexpansion
color 0B
TITLE DreamRise Exam - Smart Auto Deployer
echo ===================================================
echo      DreamRise Exam - Smart Setup ^& Deploy
echo ===================================================
echo.

:: 1. Check Node.js & Clasp
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js is missing. Please install Node.js first.
    pause & exit
)
where clasp >nul 2>nul
if %errorlevel% neq 0 (
    echo [~] Installing Google Clasp globally...
    call npm install -g @google/clasp
)

:: 2. Setup Configuration
set CONFIG_FILE=dreamrise_config.txt
set "PROJECT_PATH=%cd%"

if exist "%CONFIG_FILE%" (
    for /f "usebackq delims=" %%x in ("%CONFIG_FILE%") do (set "%%x")
    echo [+] Saved Configuration Loaded:
    echo     Script ID : !SCRIPT_ID!
    echo ---------------------------------------------------
    set "changeScript=N"
    set /p changeScript="Do you want to enter a NEW Script ID? [Y/N, Default: N]: "
    
    if /i "!changeScript!"=="Y" (
        set /p SCRIPT_ID="Enter New Apps Script ID: "
        echo SCRIPT_ID=!SCRIPT_ID!> "%CONFIG_FILE%"
        echo [+] New Script ID saved!
    )
) else (
    echo [!] Initial Setup
    echo ---------------------------------------------------
    set /p SCRIPT_ID="Paste your Google Apps Script ID: "
    echo SCRIPT_ID=!SCRIPT_ID!> "%CONFIG_FILE%"
    echo [+] Saved successfully!
)

:: 3. Create Required Clasp Files
echo.
echo [~] Configuring project files...

:: Generate .clasp.json
echo {"scriptId":"!SCRIPT_ID!","rootDir":"."} > .clasp.json

:: Generate appsscript.json if not exists (Fixes many deployment errors)
if not exist "appsscript.json" (
    echo {"timeZone": "Asia/Dhaka","dependencies": {},"exceptionLogging": "STACKDRIVER","runtimeVersion": "V8"} > appsscript.json
    echo [+] Created missing appsscript.json
)

:: Create STRICT .claspignore (Only allows specific files to be pushed)
echo **/** > .claspignore
echo !code.gs >> .claspignore
echo !code.js >> .claspignore
echo !SetupUI.html >> .claspignore
echo !webapp.html >> .claspignore
echo !appsscript.json >> .claspignore
echo [+] Created strict .claspignore (Whitelisted 3 files only)

:: 4. Google Login Check
echo.
set "doLogin=N"
set /p doLogin="Do you need to login to Google Clasp? [Y/N, Default: N]: "
if /i "!doLogin!"=="Y" (
    call clasp login
)

:: 5. Deployment
echo.
echo [~] Deploying ONLY targeted files to Google Apps Script...
call clasp push --force

echo.
echo ===================================================
if %errorlevel% equ 0 (
    echo    SUCCESS! Code pushed perfectly.
) else (
    echo    [!] FAILED! Please check the syntax error.
)
echo ===================================================
pause
