// main.js *top level functionality, starts window, sets up websocket, etc
console.log('main program running');
const { app, ipcMain } = require('electron');
const { createWindow, getMainWindow } = require('./windowManager');
const { DeviceSession } = require('./deviceSession');
// Legacy audio state remains until the sound channel is moved into DeviceSession.
const state = require('./config');
const { sendToneOverWebSocket, startStreaming, stopStreaming } = require('./audioManager');

const deviceSession = new DeviceSession();

function sendToRenderer(channel, payload) {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, payload);
    }
}

deviceSession.on('status', (message) => sendToRenderer('status', message));
deviceSession.on('transmit', () => sendToRenderer('triggerTX'));
deviceSession.on('receive', () => sendToRenderer('triggerRX'));
deviceSession.on('rssi', (rssi) => sendToRenderer('updateRSSI', rssi));
deviceSession.on('error', (error) => console.error('Device session error:', error.message));

// IPC communication with renderer process (renderer.js)
ipcMain.on('r2m', (_event, intentJSON) => {
    if (!deviceSession.sendIntent(intentJSON)) {
        sendToRenderer('status', 'Command not sent: Skuttle device is not connected');
    }
});

ipcMain.once('Ready', () => {
    deviceSession.connect();
});

ipcMain.on('playTone', () => {
    sendToneOverWebSocket(state.wsSound);
});

ipcMain.on('streamToggle', () => {
    if (state.isStreaming) {
        stopStreaming();
    } else {
        startStreaming(state.wsSound);
    }
});

// Called when ESP32 has HAS_AUDIO_IN enabled and INMP441 is wired.
// Mic audio arrives as binary PCM and is forwarded to renderer via 'micData' IPC.
// Althea can subscribe to 'micData' events for STT processing.
ipcMain.on('connectMic', () => {
    sendToRenderer('status', 'Microphone return path is not implemented in the current firmware');
});

app.whenReady().then(() => {
    const mainWindow = createWindow();
    // Wait for window to actually finish loading before connecting
    mainWindow.webContents.on('did-finish-load', () => {
        ipcMain.emit('Ready'); // Trigger the connection setup via IPC
    });
});

app.on('activate', () => {
    if (getMainWindow() === null) {
        createWindow();
    }
});

app.on('window-all-closed', () => {
    deviceSession.close();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    deviceSession.close();
});
