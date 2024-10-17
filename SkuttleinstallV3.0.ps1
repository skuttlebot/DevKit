# Initialize log file
$logFile = "SkuttlebotInstallLog.txt"
Write-Host "Logging to: $logFile"
Write-Output "Starting installation process at $(Get-Date)" | Out-File $logFile -Append

# Ensure the script runs from the folder where it is saved (script root)
Set-Location -Path $PSScriptRoot
Write-Output "Running script from location: $PSScriptRoot" | Out-File $logFile -Append

# Check if running from System32 and prevent execution
$currentDir = Get-Location
if ($currentDir.Path -like "*System32*") {
    Write-Host "ERROR: This script should not be run from the System32 directory." -ForegroundColor Red
    Write-Output "ERROR: Script run from System32 - exited." | Out-File $logFile -Append
    pause
    exit
}


# Prompt the user for confirmation to proceed
$confirmation = Read-Host "Warning: This operation may overwrite your local changes. Do you want to continue? (Y/N)"
if ($confirmation -notmatch "^[Yy]$") {
    Write-Host "Operation canceled."
    Write-Output "Operation canceled by user at $(Get-Date)" | Out-File $logFile -Append
    pause
    exit
}

# Function to install Python if missing
function Check-Python {
    Write-Host "Checking for Python installation..."
    pause
    # Check if Python is installed
    $pythonPath = (Get-Command "python" -ErrorAction SilentlyContinue).Path
    if ($null -eq $pythonPath) {
        Write-Host "Python not found. Installing Python..."

        try {
            # Set download URL and installer path
            $pythonInstallerUrl = "https://www.python.org/ftp/python/3.12.6/python-3.12.6-amd64.exe"
            $pythonInstallerPath = "$env:TEMP\python-installer.exe"

            # Download Python installer
            Write-Host "Downloading Python installer..."
            Invoke-WebRequest -Uri $pythonInstallerUrl -OutFile $pythonInstallerPath -ErrorAction Stop
            Write-Host "Python installer downloaded."

            # Install Python silently
            Write-Host "Installing Python..."
            Start-Process -FilePath $pythonInstallerPath -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1" -Wait
            Write-Host "Python installation completed."

            # Refresh environment variables to detect the new Python installation
            $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::Machine)

            # Retrieve the newly installed Python path
            $pythonPath = (Get-Command "python" -ErrorAction SilentlyContinue).Path
            if ($null -ne $pythonPath) {
                # Configure Python for node-gyp, handle spaces in path
                npm config set python "`"$pythonPath`""
                Write-Host "Python configured for node-gyp."
                Write-Output "Python installed and configured at $(Get-Date)" | Out-File $logFile -Append
            } else {
                Write-Host "Failed to detect Python after installation."
                Write-Output "ERROR: Python detection failed after installation at $(Get-Date)" | Out-File $logFile -Append
            }
        } catch {
            Write-Host "Python installation failed. Please install it manually."
            Write-Output "ERROR: Python installation failed at $(Get-Date): $_" | Out-File $logFile -Append
        }
    } else {
        Write-Host "Python is already installed at $pythonPath."        
    }
}

# Function to check and install NVM with error handling
function Check-NVM {
    Write-Host "Checking NVM"
    Pause
    Write-Output "Checking for NVM..." | Out-File $logFile -Append
    try {
        if (-not (Get-Command 'nvm' -ErrorAction SilentlyContinue)) {
            Write-Host "nvm is not installed. Installing..."
            $nvmUrl = "https://github.com/coreybutler/nvm-windows/releases/download/1.1.7/nvm-setup.zip"
            $nvmZip = "nvm-setup.zip"
            Invoke-WebRequest -Uri $nvmUrl -OutFile $nvmZip
            Expand-Archive -Path $nvmZip -DestinationPath ".\nvm-setup"
            Start-Process ".\nvm-setup\nvm-setup.exe" -Wait
            Remove-Item $nvmZip
            Remove-Item ".\nvm-setup" -Recurse
            Write-Output "NVM installed successfully at $(Get-Date)" | Out-File $logFile -Append
        } else {
            Write-Host "nvm is already installed."
            Write-Output "NVM is already installed." | Out-File $logFile -Append
        }
    } catch {
        Write-Host "Failed to install NVM."
        Write-Output "ERROR: NVM installation failed at $(Get-Date): $_" | Out-File $logFile -Append
    }
}

# Function to check and install Node.js with error handling
function Check-NodeJS {
    Write-Host "Checking NodeJS"
    pause
    Write-Output "Checking for Node.js..." | Out-File $logFile -Append
    # Check if Node.js is already installed
    if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
        Write-Host "Node.js is not installed. Installing..."
        Write-Output "Node.js is not installed, attempting download..." | Out-File $logFile -Append
        try {
            # Set paths for download and logging
            $nodeUrl = "https://nodejs.org/dist/v18.17.0/node-v18.17.0-x64.msi"
            $nodeMsi = "$env:TEMP\nodejs.msi"
            $msiLog = "$env:TEMP\nodejs-install-log.txt"
    
            # Download the Node.js installer
            Write-Host "Downloading Node.js..."
            Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -ErrorAction Stop
            Write-Output "Node.js downloaded successfully." | Out-File $logFile -Append
    
            # Verify download before proceeding
            if (-not (Test-Path $nodeMsi)) {
                Write-Host "Error: Node.js installer download failed."
                Write-Output "ERROR: Node.js installer download failed at $(Get-Date)" | Out-File $logFile -Append
                return  # Exit function if download failed
            }
    
            # Run the Node.js installer in quiet mode and log the process
            Write-Host "Installing Node.js..."
            Start-Process "msiexec.exe" -ArgumentList "/i $nodeMsi /quiet /norestart /log $msiLog" -Wait
    
            # Check msiexec log for errors after installation attempt
            if (Test-Path $msiLog) {
                $logContent = Get-Content $msiLog
                if ($logContent -like "*error*") {
                    Write-Host "Error detected during Node.js installation. Check the log at $msiLog."
                    Write-Output "ERROR: Node.js installation failed: $logContent" | Out-File $logFile -Append
                } else {
                    Write-Host "Node.js installed successfully."
                    Write-Output "Node.js installed successfully at $(Get-Date)" | Out-File $logFile -Append
                }
            } else {
                Write-Host "msiexec log not found, installation might have failed."
                Write-Output "ERROR: Node.js installation failed, msiexec log missing." | Out-File $logFile -Append
            }
    
            # Remove the installer if installation is successful
            if (Get-Command "node" -ErrorAction SilentlyContinue) {
                Remove-Item $nodeMsi
            }
    
        } catch {
            Write-Host "Failed to install Node.js."
            Write-Output "ERROR: Node.js installation failed at $(Get-Date): $_" | Out-File $logFile -Append
        }
    } else {
        Write-Host "Node.js is already installed."
        Write-Output "Node.js is already installed." | Out-File $logFile -Append
    }
    
}

# Function to check and install Git with error handling
function Check-Git {
    # Refresh the PATH environment variable for the current session
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::Machine) + ";" + [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::User)
    Write-Host "Checking Git"
    Pause
    Write-Output "Checking for Git..." | Out-File $logFile -Append
    try {
        if (-not (Get-Command 'git' -ErrorAction SilentlyContinue)) {
            Write-Host "Git is not installed. Installing..."
            $gitUrl = (Invoke-RestMethod "https://api.github.com/repos/git-for-windows/git/releases/latest").assets | Where-Object { $_.name -like '*64-bit.exe' } | Select-Object -First 1 -ExpandProperty browser_download_url
            $gitInstaller = "GitInstaller.exe"
            Invoke-WebRequest -Uri $gitUrl -OutFile $gitInstaller
            Start-Process $gitInstaller -ArgumentList "/VERYSILENT", "/NORESTART" -Wait
            Remove-Item $gitInstaller
            Write-Output "Git installed successfully at $(Get-Date)" | Out-File $logFile -Append
            # Refresh PATH to include Node.js and npm
            $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::Machine) + ";" + [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::User)
        } else {
            Write-Host "Git is already installed."
            Write-Output "Git is already installed." | Out-File $logFile -Append
        }
    } catch {
        Write-Host "Failed to install Git."
        Write-Output "ERROR: Git installation failed at $(Get-Date): $_" | Out-File $logFile -Append
    }
}

# Function to clone or update the SkuttlebotDevKit repository
function Clone-Or-Update-Repo {
    Write-Host "Checking Repo"
    Pause
    Write-Output "Checking for SkuttlebotDevKit repository..." | Out-File $logFile -Append
    try {
        if (-not (Test-Path "./SkuttlebotDevKit")) {
            Write-Host "Cloning SkuttlebotDevKit repository..."
            git clone https://github.com/skuttlebot/DevKit.git SkuttlebotDevKit
            Write-Output "Repository cloned at $(Get-Date)" | Out-File $logFile -Append
        } else {
            Write-Host "SkuttlebotDevKit directory exists. Updating repository..."
            Set-Location "SkuttlebotDevKit"
            git pull origin main
            Set-Location ..
            Write-Output "Repository updated at $(Get-Date)" | Out-File $logFile -Append
        }
    } catch {
        Write-Host "Failed to clone or update the repository."
        Write-Output "ERROR: Repository operation failed at $(Get-Date): $_" | Out-File $logFile -Append
    }
}

# Function to install Visual Studio Build Tools if missing
function Install-Build-Tools {
    Write-Host "Checking for Visual Studio Build Tools..."
    pause
    # Check if Visual Studio Build Tools (C++ build tools) are installed
    $vswherePath = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    try {
        if (-not (Test-Path $vswherePath)) {
            Write-Host "Visual Studio Installer (vswhere.exe) not found. Proceeding with installation..."
            
            # Download and install Visual Studio Build Tools
            $vsInstallerUrl = "https://aka.ms/vs/17/release/vs_BuildTools.exe"
            $vsInstallerPath = "$env:TEMP\vs_BuildTools.exe"
            
            Write-Host "Downloading Visual Studio Build Tools..."
            Invoke-WebRequest -Uri $vsInstallerUrl -OutFile $vsInstallerPath -ErrorAction Stop
            Write-Host "Installing Visual Studio Build Tools..."

            # Install the required C++ build tools
            Start-Process -FilePath $vsInstallerPath -ArgumentList "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --quiet --wait" -Wait
            Write-Host "Visual Studio Build Tools installed successfully."
            Write-Output "Visual Studio Build Tools installed at $(Get-Date)" | Out-File $logFile -Append
        } else {
            Write-Host "Visual Studio Build Tools are already installed."
            Write-Output "Visual Studio Build Tools already installed at $(Get-Date)" | Out-File $logFile -Append
        }
    } catch {
        Write-Host "Failed at Visual Studio Build Tools installation."
        Write-Output "ERROR: Visual Studio Build Tools failed at $(Get-Date): $_" | Out-File $logFile -Append
    }
}


# Function to ensure distutils (provided by setuptools) is available for Python
function Ensure-Distutils {
    Write-Host "Ensuring distutils is installed for Python..."
    pause
    # Check if pip is available
    $pipPath = (Get-Command "pip" -ErrorAction SilentlyContinue).Path
    if ($null -eq $pipPath) {
        Write-Host "pip is not installed. Installing pip..."
        python -m ensurepip --upgrade
    }

    # Install setuptools if distutils is missing
    $distutilsCheck = python -m pip show setuptools
    if ($distutilsCheck -eq $null) {
        Write-Host "Installing setuptools (which provides distutils)..."
        python -m pip install --upgrade setuptools
        Write-Host "setuptools (distutils) installed successfully."
    } else {
        Write-Host "setuptools (distutils) is already installed."
    }
}

# Function to install npm dependencies with basic error handling
function Install-Npm-Dependencies {
    Write-Host "Checking Dependencies"
    pause
    Write-Output "Checking and installing npm dependencies..." | Out-File $logFile -Append

    try {
        # Set working directory to the SkuttlebotDevKit folder
        Set-Location "./SkuttlebotDevKit"

        # Ensure Python's distutils is available
        Ensure-Distutils

        # Run npm install to install dependencies
        Write-Host "Running npm install..."
        npm.cmd install --loglevel verbose 2>&1 | Tee-Object -FilePath "npm-install-log.txt"
        
        # Check if npm install succeeded
        if ($LASTEXITCODE -eq 0) {
            Write-Host "npm dependencies installed successfully."
            Write-Output "npm dependencies installed successfully at $(Get-Date)" | Out-File $logFile -Append
            npm.cmd audit fix
        } else {
            Write-Host "npm install failed with exit code $LASTEXITCODE."
            Write-Output "ERROR: npm dependencies installation failed at $(Get-Date)" | Out-File $logFile -Append
        }
    } catch {
        Write-Host "An error occurred during npm install."
        Write-Output "ERROR: npm dependencies installation failed at $(Get-Date): $_" | Out-File $logFile -Append
    }
}



# Run all checks and installations
Check-NodeJS
Check-Python
Check-NVM
Check-Git
Clone-Or-Update-Repo
Install-Build-Tools
Install-Npm-Dependencies

# Ensure the PATH environment variable is refreshed for the current session
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::Machine)

# Optionally, refresh the User environment as well (if you added paths for the current user)
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", [System.EnvironmentVariableTarget]::User)

Write-Host "Environment PATH variables have been refreshed."

# Final confirmation and optional restart
Write-Host "Setup complete. SkuttlebotDevKit is ready to use."
Write-Output "Setup completed at $(Get-Date)" | Out-File $logFile -Append

# Ask user if they want to restart the system
$restart = Read-Host "Do you want to restart the system now? **optional** (Y/N)"
if ($restart -match "^[Yy]$") {
    Restart-Computer
} else {
    Write-Host "You can restart the system later."
}

pause
