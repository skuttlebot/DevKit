:: 1-click installer.  Place where it is desired to create the SkuttlebotDevkit folder
@echo off
setlocal

:: Check for administrative privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo This script requires administrative privileges.
    goto end
)

echo Starting SkuttlebotDevKit setup...

:: Prompt the user to confirm before proceeding
set /p userConfirm="Warning: This operation may overwrite your local changes. Do you want to continue? (Y/N): "
if /i not "%userConfirm%" == "Y" (
    echo Operation canceled.
    goto end
)

:: Check if nvm is installed
nvm version >nul 2>&1
if %errorlevel% neq 0 (
    echo nvm is not installed. Installing nvm for Windows...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/coreybutler/nvm-windows/releases/download/1.1.7/nvm-setup.zip' -OutFile 'nvm-setup.zip'"
    powershell -Command "Expand-Archive -Path 'nvm-setup.zip' -DestinationPath 'nvm-setup'"
    start /wait nvm-setup/nvm-setup.exe /VERYSILENT /NORESTART
    del nvm-setup.zip
    rmdir /s /q nvm-setup
    echo nvm installation complete.
)

:: Install the latest version of Node.js
nvm install latest
nvm use latest

:: Check if Git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Git is not installed. Downloading and installing Git...
    powershell -Command "$latestGit = (Invoke-WebRequest -Uri 'https://api.github.com/repos/git-for-windows/git/releases/latest' -Headers @{'User-Agent'='Mozilla/5.0'}).body; $url = ($latestGit | ConvertFrom-Json).assets | Where-Object { $_.name -like '*64-bit.exe' } | Select-Object -ExpandProperty browser_download_url; Invoke-WebRequest -Uri $url -OutFile 'GitInstaller.exe'; Start-Process -FilePath 'GitInstaller.exe' -Args '/VERYSILENT /NORESTART' -Wait; Remove-Item 'GitInstaller.exe'"
    echo Git installation complete.
)

:: Clone the repository
if not exist "SkuttlebotDevKit" (
    echo Cloning SkuttlebotDevKit repository...
    git clone https://github.com/skuttlebot/DevKit.git SkuttlebotDevKit
    cd SkuttlebotDevKit
) else (
    echo SkuttlebotDevKit directory exists. Updating repository...
    cd SkuttlebotDevKit
    git pull origin main
)

:: Install dependencies
echo Installing project dependencies...
npm install
echo Dependencies installed.

echo Setup complete. SkuttlebotDevKit is ready to use.
pause

:end
endlocal
