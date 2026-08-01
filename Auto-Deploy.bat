@echo off
setlocal enabledelayedexpansion
color 0A
TITLE DreamRise Exam - Auto Deployer

echo ===================================================
echo      DreamRise Exam - Auto Setup ^& Deploy
echo ===================================================
echo.

set "CONFIG_FILE=dreamrise_config.txt"
set "PROJECT_PATH="
set "SCRIPT_ID="

:: ============================================================
:: 1. Check Node.js
:: ============================================================
where node >nul 2>nul
if errorlevel 1 (
    echo [!] Node.js is missing. Installing...
    winget install OpenJS.NodeJS -e --source winget
    echo [+] Node.js installed! Please close and reopen this window.
    pause
    exit /b 1
)

:: ============================================================
:: 2. Check Clasp
:: ============================================================
where clasp >nul 2>nul
if errorlevel 1 (
    echo [~] Installing Google Clasp...
    call npm install -g @google/clasp
)

:: ============================================================
:: 3. Configuration & Script ID management
:: FIXED: rewritten with GOTO labels instead of deeply nested
:: parenthesized IF blocks. The old version's bug was that
:: "set /p SCRIPT_ID=..." silently keeps the OLD value whenever
:: it receives empty input (this is normal cmd.exe behavior),
:: but the script printed "New Script ID saved!" regardless --
:: so a stray blank Enter would silently re-save the OLD ID
:: while telling you it saved a new one. This version rejects
:: empty input and re-prompts, and never claims success without
:: proof.
:: ============================================================
if exist "%CONFIG_FILE%" goto :LoadConfig
goto :NewConfig

:LoadConfig
for /f "usebackq tokens=1,* delims==" %%A in ("%CONFIG_FILE%") do (
    if /i "%%A"=="PROJECT_PATH" set "PROJECT_PATH=%%B"
    if /i "%%A"=="SCRIPT_ID"    set "SCRIPT_ID=%%B"
)
echo [+] Saved Configuration Loaded:
echo     Project Path : !PROJECT_PATH!
echo     Script ID    : !SCRIPT_ID!
echo ---------------------------------------------------

set "changeScript=N"
set /p changeScript="Do you want to enter a NEW Script ID? [Y/N, Default: N]: "
if /i "!changeScript!"=="Y" goto :EnterNewScriptId
goto :AfterConfig

:EnterNewScriptId
echo.
set "NEW_ID="
set /p NEW_ID="Enter New Apps Script ID (or paste the full script.google.com URL): "

:: FIXED: reject empty input instead of silently keeping the old
:: SCRIPT_ID while claiming a new one was saved.
if "!NEW_ID!"=="" (
    echo [X] No input detected -- Script ID was NOT changed.
    echo     Keeping previous Script ID: !SCRIPT_ID!
    goto :AfterConfig
)

call :CleanScriptId "!NEW_ID!" CLEANED_ID
set "SCRIPT_ID=!CLEANED_ID!"
echo [+] New Script ID captured: !SCRIPT_ID!
goto :SaveConfig

:NewConfig
echo [!] STEP 1/2: Folder Location
echo ---------------------------------------------------
echo Just press ENTER to use current folder.
echo ---------------------------------------------------
set /p PROJECT_PATH="Project Path [Press ENTER for Current]: "
if "!PROJECT_PATH!"=="" set "PROJECT_PATH=%cd%"

echo.
echo [!] STEP 2/2: Apps Script ID
echo ---------------------------------------------------
echo Paste your Google Apps Script ID (or the full editor URL) below.
echo ---------------------------------------------------
set "RAW_ID="
set /p RAW_ID="Apps Script ID: "
if "!RAW_ID!"=="" (
    echo [X] No Script ID entered. Cannot continue.
    pause
    exit /b 1
)
call :CleanScriptId "!RAW_ID!" CLEANED_ID
set "SCRIPT_ID=!CLEANED_ID!"

:SaveConfig
> "%CONFIG_FILE%" (
    echo PROJECT_PATH=!PROJECT_PATH!
    echo SCRIPT_ID=!SCRIPT_ID!
)
echo [+] Configuration saved to %CONFIG_FILE%:
echo     Project Path : !PROJECT_PATH!
echo     Script ID    : !SCRIPT_ID!

:AfterConfig
echo.

if "!PROJECT_PATH!"=="" (
    echo [X] PROJECT_PATH is empty -- cannot continue.
    pause
    exit /b 1
)
if "!SCRIPT_ID!"=="" (
    echo [X] SCRIPT_ID is empty -- cannot continue.
    pause
    exit /b 1
)

cd /d "!PROJECT_PATH!" 2>nul
if errorlevel 1 (
    echo [X] Could not open folder: !PROJECT_PATH!
    echo     Check the path in %CONFIG_FILE% and try again.
    pause
    exit /b 1
)

:: ============================================================
:: 4. Force-link the active Script ID to .clasp.json
:: FIXED: delete any existing .clasp.json first (a locked or
:: read-only file could previously make the ">" redirection fail
:: SILENTLY, leaving the OLD script ID in place with no warning
:: at all -- that alone would explain "new ID doesn't take,
:: deploys to the old file"). Then read the file back and show
:: it on screen, so a write failure is immediately visible
:: instead of discovered after deploying to the wrong project.
:: ============================================================
if exist ".clasp.json" del /f /q ".clasp.json"

> ".clasp.json" echo {"scriptId":"!SCRIPT_ID!"}

if not exist ".clasp.json" (
    echo [X] Failed to write .clasp.json in !PROJECT_PATH! -- check folder permissions.
    pause
    exit /b 1
)

echo.
echo [+] .clasp.json now contains:
type ".clasp.json"
echo.

findstr /C:"!SCRIPT_ID!" ".clasp.json" >nul
if errorlevel 1 (
    echo [X] VERIFICATION FAILED: .clasp.json does not contain the expected
    echo     Script ID. Aborting before any deploy happens.
    pause
    exit /b 1
)
echo [+] Verified: .clasp.json is linked to Script ID !SCRIPT_ID!

:: ============================================================
:: 5. Google Login
:: ============================================================
echo.
echo [!] Google Clasp Login
echo ---------------------------------------------------
echo Type Y to open browser login, or press ENTER to skip.
echo ---------------------------------------------------
set "doLogin=N"
set /p doLogin="Login now? [Y/N, Default: N]: "
if /i "!doLogin!"=="Y" call clasp login

:: ============================================================
:: 6. Final confirmation before pushing -- last chance to catch
:: a wrong Script ID before code actually leaves this machine.
:: ============================================================
echo.
echo ===================================================
echo   ABOUT TO DEPLOY
echo   Folder     : !PROJECT_PATH!
echo   Script ID  : !SCRIPT_ID!
echo ===================================================
set "confirmPush=Y"
set /p confirmPush="Proceed with deploy? [Y/N, Default: Y]: "
if /i "!confirmPush!"=="N" (
    echo [X] Deploy cancelled by user.
    pause
    exit /b 0
)

:: ============================================================:: 7a. Restrict files to deploy: create temporary .claspignore:: Only the three files below will be pushed (SetupUI.html, code.gs, webapp.html):: This prevents accidental deployment of other files in the folder.
:: ============================================================
echo.
echo [~] Preparing .claspignore to include only selected files...
:: Backup existing .claspignore if present
if exist ".claspignore" (
    copy /y ".claspignore" ".claspignore.bak" >nul
)
:: Verify required files exist
set "MISSING="
if not exist "SetupUI.html" set "MISSING=1" & echo [X] Missing: SetupUI.html
if not exist "code.gs" set "MISSING=1" & echo [X] Missing: code.gs
if not exist "webapp.html" set "MISSING=1" & echo [X] Missing: webapp.html
if defined MISSING (
    echo [X] One or more required files are missing. Aborting.
    if exist ".claspignore.bak" move /y ".claspignore.bak" ".claspignore" >nul
    pause
    exit /b 1
)
:: Write temporary .claspignore that ignores everything except the three files
> ".claspignore" (
    echo # Auto-generated by Auto-Deploy.bat - include only specific files
    echo **
    echo ^!SetupUI.html
    echo ^!code.gs
    echo ^!webapp.html
)

echo [+] .claspignore written to restrict push to the three files.
type ".claspignore"
echo.

:: ============================================================:: 7. Deployment -- FIXED: actually check whether push succeeded:: instead of unconditionally printing SUCCESS at the end.:: ============================================================
echo.
echo [~] Deploying code to Google Apps Script...
call clasp push --force
set "PUSHERR=%ERRORLEVEL%"
if "%PUSHERR%" NEQ "0" (
    echo.
    echo ===================================================
    echo    FAILED! clasp push returned an error -- see above.
    echo    Nothing was confirmed deployed to Script ID !SCRIPT_ID!.
    echo ===================================================    
    :: Restore original .claspignore if present, else delete temp
    if exist ".claspignore.bak" (
        move /y ".claspignore.bak" ".claspignore" >nul
    ) else (
        del /f /q ".claspignore" 2>nul
    )

    pause
    exit /b 1
)

:: After a successful push, restore original .claspignore or remove the temp
if exist ".claspignore.bak" (
    move /y ".claspignore.bak" ".claspignore" >nul
) else (
    del /f /q ".claspignore" 2>nul
)
echo [+] .claspignore restored.

echo.
echo ===================================================
echo    SUCCESS! Deployed to Script ID: !SCRIPT_ID!
echo ===================================================
pause
exit /b 0

:: ============================================================:: Helper: CleanScriptId <raw input> <output var name>:: If the user pasted a full Apps Script editor URL instead of:: just the bare ID (a very easy mistake, and one that could:: also explain deploys silently going to the wrong/no project),:: this extracts the ID segment. Also trims stray whitespace.:: Handles both URL shapes:::   https://script.google.com/d/<ID>/edit::   https://script.google.com/home/projects/<ID>/edit:: ============================================================
:CleanScriptId
setlocal enabledelayedexpansion
set "in=%~1"

:: trim leading/trailing spaces
for /f "tokens=* delims= " %%A in ("!in!") do set "in=%%A"
:TrimTrailing
if "!in:~-1!"==" " (
    set "in=!in:~0,-1!"
    goto :TrimTrailing
)

echo !in! | findstr /I "script.google.com" >nul
if not errorlevel 1 (
    set "tmp=!in!"
    for /f "delims=?" %%Q in ("!tmp!") do set "tmp=%%Q"
    if "!tmp:~-5!"=="/edit" set "tmp=!tmp:~0,-5!"
    if "!tmp:~-1!"=="/" set "tmp=!tmp:~0,-1!"
    set "last=!tmp!"
    for %%S in ("!tmp:/=" "!") do set "last=%%~S"
    set "in=!last!"
)

endlocal & set "%~2=%in%"
goto :eof
