const WebSocket = require('ws');
const { getMainWindow } = require('./windowManager');
const { handleSoundMessage } = require('./audioManager');
const { ipcMain } = require('electron');

const PRIMARY_PORT = 8080;
const BACKUP_PORT = 8081;
let currentPort = PRIMARY_PORT;
let wsCommand = null;
let wsSound = null;
let wsCamera = null;
let lastMessageTime = Date.now();
let reconnectTimeout = null;
const reconnectInterval = 5000;

const state = {
    isConnectedCommand: false,
    isLonely: true,
    isSoundConnected: false,
    isCameraConnected: false
};

// Function to connect to the Command WebSocket
function connectCommand() {
    if (wsCommand && wsCommand.readyState === WebSocket.CONNECTING) return;

    console.log(`Attempting to connect to Command on port ${currentPort}...`);
    wsCommand = new WebSocket(`ws://skuttlehost.local:${currentPort}/Command`);

    wsCommand.on('open', () => {
        console.log(`Connected to Command on port ${currentPort}`);
        state.isLonely = false;
        state.isConnectedCommand = true;
        lastMessageTime = Date.now();
        sendHandshake();
        getMainWindow().webContents.send('status', 'Command Connected');
        clearTimeout(reconnectTimeout);

        // Connect to Sound WebSocket after Command is established
        connectSound();
    });

    wsCommand.on('message', (message) => {
        const messageString = typeof message === 'string' ? message : message.toString();
        console.log(`Command Message received: ${messageString}`);
        lastMessageTime = Date.now();
        getMainWindow().webContents.send('triggerRX');

        if (messageString.startsWith('handshake,')) {
            state.isConnectedCommand = true;
            getMainWindow().webContents.send("status", "Connected");
        } else if (messageString.startsWith('camconnect')) {
            connectCamera();
        } else if (messageString.startsWith('camdisconnect')) {
            disconnectCamera();
        }
    });

    wsCommand.on('close', () => {
        console.log('Command connection closed');
        state.isConnectedCommand = false;
        state.isLonely = true;

        // Close Sound and Camera connections if Command is lost
        disconnectSound();
        disconnectCamera();

        scheduleReconnect();
    });

    wsCommand.on('error', (error) => {
        console.error(`Command error on port ${currentPort}: ${error}`);
        state.isConnectedCommand = false;
        state.isLonely = true;

        // Close Sound and Camera connections on error
        disconnectSound();
        disconnectCamera();

        scheduleReconnect();
    });
}

// Function to send a handshake
function sendHandshake() {
    const handshakeData = `handshake,ID,SN`;
    if (wsCommand && wsCommand.readyState === WebSocket.OPEN) {
        console.log("Sending handshake...");
        wsCommand.send(handshakeData);
        getMainWindow().webContents.send('triggerTX');
    }
}

// Function to connect to the Sound WebSocket
function connectSound() {
    if (state.isSoundConnected) return;

    console.log('Attempting to connect to Sound...');
    wsSound = new WebSocket(`ws://skuttlehost.local:${currentPort}/Sound`);

    wsSound.on('open', () => {
        console.log('Sound WebSocket connected');
        state.isSoundConnected = true;
        getMainWindow().webContents.send('audio', 'Audio Connected');
    });

    wsSound.on('message', (message) => {
        handleSoundMessage(message, wsSound);
        getMainWindow().webContents.send('triggerRX');
    });

    wsSound.on('close', () => {
        console.log('Sound connection closed');
        state.isSoundConnected = false;
    });

    wsSound.on('error', (error) => {
        console.error('Sound WebSocket error:', error);
        state.isSoundConnected = false;
    });
}

// Function to disconnect the Sound WebSocket
function disconnectSound() {
    if (wsSound) {
        wsSound.close();
        console.log('Sound connection closed manually');
        state.isSoundConnected = false;
    }
}

// Function to connect to the Camera WebSocket when requested
function connectCamera() {
    if (state.isCameraConnected) return;

    console.log('Attempting to connect to Camera...');
    wsCamera = new WebSocket(`ws://skuttlehost.local:${currentPort}/Camera`);

    wsCamera.on('open', () => {
        console.log('Camera WebSocket connected');
        state.isCameraConnected = true;
        getMainWindow().webContents.send('video', 'Camera Connected');
    });

    wsCamera.on('message', (data) => {
        getMainWindow().webContents.send('video', data);
        getMainWindow().webContents.send('triggerRX');
    });

    wsCamera.on('close', () => {
        console.log('Camera connection closed');
        state.isCameraConnected = false;
    });

    wsCamera.on('error', (error) => {
        console.error('Camera WebSocket error:', error);
        state.isCameraConnected = false;
    });
}

// Function to disconnect the Camera WebSocket
function disconnectCamera() {
    if (wsCamera) {
        wsCamera.close();
        console.log('Camera connection closed manually');
        state.isCameraConnected = false;
    }
}

// Function to schedule a reconnect attempt
function scheduleReconnect() {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(() => {
        currentPort = (currentPort === PRIMARY_PORT) ? BACKUP_PORT : PRIMARY_PORT;
        console.log(`Switching ports. Now using port: ${currentPort}`);
        connectCommand();
    }, reconnectInterval);
}

connectCommand();

module.exports = {
    connectCommand,
    connectSound,
    connectCamera,
    disconnectCamera,
    disconnectSound,
    sendHandshake,
};
