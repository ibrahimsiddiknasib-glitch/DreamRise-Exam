@echo off
setlocal enabledelayedexpansion
color 0A
TITLE DreamRise Exam - 1-Click Auto Deployer

echo ===================================================
echo      DreamRise Exam - Auto Setup ^& Deploy
echo ===================================================
echo.

:: ১. Node.js চেক করা এবং ইন্সটল করা (উইন্ডোজের winget ব্যবহার করে)
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] আপনার পিসিতে Node.js ইন্সটল করা নেই! 
    set /p installNode="আপনি কি স্বয়ংক্রিয়ভাবে Node.js ইন্সটল করতে চান? (Y/N): "
    if /i "!installNode!"=="Y" (
        echo [~] Node.js ডাউনলোড এবং ইন্সটল হচ্ছে (কিছুক্ষণ সময় লাগতে পারে)...
        winget install OpenJS.NodeJS -e --source winget
        echo [+] Node.js সফলভাবে ইন্সটল হয়েছে! দয়া করে কমান্ড উইন্ডোটি কেটে দিয়ে আবার ওপেন করুন।
        pause
        exit
    ) else (
        echo [!] স্ক্রিপ্টটি চালাতে আপনাকে নিজে Node.js ইন্সটল করতে হবে।
        pause
        exit
    )
) ELSE (
    echo [+] Node.js ঠিকঠাক আছে।
)

:: ২. Clasp চেক ও ইন্সটল করা
call npm list -g @google/clasp >nul 2>nul
if %errorlevel% neq 0 (
    echo [~] Google Clasp ইন্সটল করা হচ্ছে...
    call npm install -g @google/clasp
    echo [+] Clasp ইন্সটল সম্পন্ন!
) ELSE (
    echo [+] Google Clasp রেডি আছে।
)
echo.

:: ৩. কনফিগারেশন ফাইল চেক ও সেভ করা (যাতে বারবার ফোল্ডার/আইডি না চায়)
set CONFIG_FILE=dreamrise_config.txt

if exist %CONFIG_FILE% (
    echo [+] আগের সেভ করা কনফিগারেশন পাওয়া গেছে!
    for /f "delims=" %%x in (%CONFIG_FILE%) do (set "%%x")
) else (
    echo [!] কোনো আগের সেটআপ পাওয়া যায়নি। চলুন একবার সেটআপ করে নিই!
    echo.
    echo টিপস: আপনি যদি এই ফাইলটি প্রজেক্ট ফোল্ডারের ভেতরেই রান করে থাকেন, তবে নিচে শুধু একটি ডট (.) দিন।
    set /p PROJECT_PATH="আপনার প্রজেক্ট ফোল্ডারের লোকেশন দিন (যেমন: E:\DreamRise-Exam): "
    
    if "!PROJECT_PATH!"=="." (
        set "PROJECT_PATH=%cd%"
    )

    set /p SCRIPT_ID="আপনার Google Apps Script ID টি পেস্ট করুন: "
    
    echo PROJECT_PATH=!PROJECT_PATH!> %CONFIG_FILE%
    echo SCRIPT_ID=!SCRIPT_ID!>> %CONFIG_FILE%
    echo [+] ডাটা সেভ করা হয়েছে! পরবর্তীতে আর এই তথ্যগুলো চাইবে না।
)

:: ৪. প্রজেক্ট ফোল্ডারে প্রবেশ (যেকোনো ড্রাইভ থেকে)
cd /d "!PROJECT_PATH!"
echo.

:: ৫. লগইন চেক
echo [?] Google Clasp-এ কি আপনার অ্যাকাউন্ট লগইন করা আছে?
set /p doLogin="নতুন করে লগইন করতে চাইলে 'Y' আর করা থাকলে 'N' লিখুন (Y/N): "
if /i "!doLogin!"=="Y" (
    echo [~] ব্রাউজারে লগইন পেজ ওপেন হচ্ছে...
    call clasp login
)

:: ৬. প্রজেক্ট লিংক ও কোড পুশ
echo.
if not exist ".clasp.json" (
    echo [~] আপনার প্রজেক্ট গুগল শিটের সাথে লিংক করা হচ্ছে...
    call clasp clone !SCRIPT_ID!
)

echo [~] আপনার কোড গুগল শিটে আপলোড (Push) করা হচ্ছে...
call clasp push

echo.
echo ===================================================
echo    মাশাআল্লাহ! সফলভাবে আপনার কোড ডিপ্লয় হয়েছে।
echo ===================================================
pause
