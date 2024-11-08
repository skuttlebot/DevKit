// windowManager.js
const { BrowserWindow } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false,
            allowRunningInsecureContent: true,
            media: { videoCapture: true },
        }
    });
    mainWindow.loadFile('index.html');
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    return mainWindow;
}

function getMainWindow() {
    if (mainWindow) {
        return mainWindow;
    } else {
        console.error("Main window not initialized yet");
        return null;
    }
}

module.exports = { createWindow, getMainWindow };