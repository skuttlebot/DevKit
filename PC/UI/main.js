// main.js *top level functionality, starts window, sets up websocket, etc
console.log('main program running');
const path = require('path');
const { app, ipcMain } = require('electron');
const { createWindow, getMainWindow } = require('./windowManager');
const state = require('./config');
const { connectCommand, connectCamera, connectSound } = require('./websocketManager');
const { sendToneOverWebSocket, startStreaming, stopStreaming } = require('./audioManager');

// IPC communication with renderer process (renderer.js)
ipcMain.on('r2m', (event, command) => {
    const commandData = `command,${command.commandString}`;
    console.log("Sent to Skuttlemove:", commandData);
    if (state.isConnectedCommand) {
        state.wsCommand.send(commandData);
        getMainWindow().webContents.send('triggerTX');
    }
});

ipcMain.on('Ready', () => {
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

app.whenReady().then(() => {
    createWindow();
    setTimeout(() => {
        ipcMain.emit('Ready'); // Trigger the connection setup via IPC
    }, 100); // Slight delay to avoid race conditions
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
