// windowManager.js
const { BrowserWindow } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 720,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true,
            allowRunningInsecureContent: false,
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