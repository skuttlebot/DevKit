@echo off
setlocal enableextensions

:: Ensure we switch to the directory where the script is located
cd /d "%~dp0"

:: Check if the script is running from a restricted directory (e.g., System32)
set "current_dir=%cd%"
if /i "%current_dir:~-12%"=="System32" (
    echo ERROR: This script should not be run from the System32 directory.
    pause
    exit /B 1
)

:: Check for administrative privileges
net session >nul 2>&1
if %errorlevel% == 0 (
    :: We are elevated, continue the script
    echo Running in Admin Mode
    echo The current working directory is: %cd%
    pause
    PowerShell -NoProfile -ExecutionPolicy Bypass -Command "& '%cd%\SkuttleinstallV3.0.ps1'"
    
) else (
    :: Not elevated, relaunch as administrator
    echo Requesting administrative privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /B
)


