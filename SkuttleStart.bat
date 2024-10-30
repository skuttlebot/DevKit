
@echo off
REM assumed this is executed from the same folder as package.json

REM Log the start time
echo Starting app at %date% %time% > log.txt

REM Run the app and log errors
echo Starting npm... >> log.txt
npm start >> log.txt 2>&1

REM Check if npm exited with an error
if errorlevel 1 (
    echo App failed to start. Check log.txt for details.
    pause
)

REM Log the end time
echo Finished at %date% %time% >> log.txt
REM start app
npm start


:end
endlocal
