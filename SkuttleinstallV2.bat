:: 1-click installer. Place where it is desired to create the SkuttlebotDevKit folder
@echo off
setlocal

:: Check if script is running from an undesirable system directory
echo %CD% | findstr /C:"System32" >nul
if not %errorlevel% equ 0 (
    echo This script should not be run from the System32 directory. Please run it from a different directory.
    pause
    exit /b 1
)

:: Check for administrative privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrative privileges...
    powershell -Command "Start-Process cmd -ArgumentList '/c %~dpnx0' -Verb runAs"
    exit /b 0
)

:: Main Script Logic
echo Starting SkuttlebotDevKit setup...
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Still not in Admin
    pause
    exit /b 1
)

:: Prompt the user to confirm before proceeding
set /p userConfirm="Warning: This operation may overwrite your local changes. Do you want to continue? (Y/N): "
if /i not "%userConfirm%" == "Y" (
    echo Operation canceled.
    pause
    exit /b 1
)

:: Check if nvm is installed
echo Checking nvm
nvm version >nul 2>&1
if %errorlevel% neq 0 (
    echo nvm is not installed. Installing nvm for Windows...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/coreybutler/nvm-windows/releases/download/1.1.7/nvm-setup.zip' -OutFile 'nvm-setup.zip'"
    powershell -Command "Expand-Archive -Path 'nvm-setup.zip' -DestinationPath 'nvm-setup'"
    start /wait nvm-setup/nvm-setup.exe /VERYSILENT /NORESTART
    if %errorlevel% neq 0 (
        echo nvm installation failed.
        pause
        exit /b 1
    )
    del nvm-setup.zip
    rmdir /s /q nvm-setup
    echo nvm installation complete.
)
echo nvm OK
pause

:: Check if Node.js is installed and update to a stable version
echo Checking Node.js
nvm on
nvm list >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed. Installing Node.js...
    nvm install 18.17.0
    if %errorlevel% neq 0 (
        echo Node.js installation failed.
        pause
        exit /b 1
    )
    nvm use 18.17.0
    echo Node.js installation complete.
) else (
    echo Node.js is already installed. Switching to the stable version...
    nvm install 18.17.0
    if %errorlevel% neq 0 (
        echo Node.js update failed.
        pause
        exit /b 1
    )
    nvm use 18.17.0
    if %errorlevel% neq 0 (
        echo Node.js activation failed.
        pause
        exit /b 1
    )
)
echo Node.js OK
pause

:: Check if Git is installed
echo Checking Git
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Git is not installed. Downloading and installing Git...
    powershell -Command "$latestGit = (Invoke-WebRequest -Uri 'https://api.github.com/repos/git-for-windows/git/releases/latest' -Headers @{'User-Agent'='Mozilla/5.0'}).body; $url = ($latestGit | ConvertFrom-Json).assets | Where-Object { $_.name -like '*64-bit.exe' } | Select-Object -ExpandProperty browser_download_url; Invoke-WebRequest -Uri $url -OutFile 'GitInstaller.exe'; Start-Process -FilePath 'GitInstaller.exe' -Args '/VERYSILENT /NORESTART' -Wait; Remove-Item 'GitInstaller.exe'"
    if %errorlevel% neq 0 (
        echo Git installation failed.
        pause
        exit /b 1
    )
    echo Git installation complete.
) else (
    echo Git is already installed.
)
echo Git OK
pause

:: Clone the repository
echo Checking Files
cd /d %~dp0
echo Current directory: %cd%
if not exist "SkuttlebotDevKit" (
    echo Cloning SkuttlebotDevKit repository...
    git clone https://github.com/skuttlebot/DevKit.git SkuttlebotDevKit
    if %errorlevel% neq 0 (
        echo Cloning repository failed.
        pause
        exit /b 1
    )
    cd SkuttlebotDevKit
) else (
    echo SkuttlebotDevKit directory exists. Updating repository...
    cd SkuttlebotDevKit
    git pull origin main
    if %errorlevel% neq 0 (
        echo Updating repository failed.
        pause
        exit /b 1
    )
)
echo Repository OK
pause

:: Install dependencies
echo Installing project dependencies...
(
    npm install --loglevel verbose
) && (
    echo npm install completed successfully.
    echo Dependencies installed.
    echo Setup complete. SkuttlebotDevKit is ready to use.
    pause
) || (
    echo npm install failed with errorlevel %errorlevel%.
    pause
    exit /b 1
)
echo Setup complete. SkuttlebotDevKit is ready to use.
pause

:end
endlocal
