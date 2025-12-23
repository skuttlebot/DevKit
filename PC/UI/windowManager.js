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
            webSecurity: true,  // Enable web security
            // allowRunningInsecureContent removed - not needed with proper CSP
        }
    });

    // Set Content Security Policy to allow WebSocket connections to robot
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'; " +
                    "connect-src 'self' ws://skuttlehost.local:* ws://localhost:*; " +
                    "img-src 'self' data: blob: http://skuttlehost.local:*; " +
                    "style-src 'self' 'unsafe-inline'; " +
                    "script-src 'self'"
                ]
            }
        });
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