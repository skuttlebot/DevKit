@echo off
REM assumed this is executed from the same folder as package.json

REM Run the app without redirecting output to log.txt
echo Starting npm...
npm start

REM Check if npm exited with an error
if errorlevel 1 (
    echo App failed to start. Check the output above for details.
    pause
)
