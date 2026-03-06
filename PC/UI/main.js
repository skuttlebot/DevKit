// main.js *top level functionality, starts window, sets up websocket, etc
console.log('main program running');
const { app, ipcMain } = require('electron');
const { createWindow, getMainWindow } = require('./windowManager');
const state = require('./config');
const { connectCommand, connectMic } = require('./websocketManager');
const { sendToneOverWebSocket, startStreaming, stopStreaming } = require('./audioManager');

// IPC communication with renderer process (renderer.js)
ipcMain.on('r2m', (_event, intentJSON) => {
    if (state.isConnectedCommand) {
        state.wsCommand.send(intentJSON);
        getMainWindow().webContents.send('triggerTX');
    }
});

ipcMain.once('Ready', () => {
    connectCommand();
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
    connectMic();
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
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
