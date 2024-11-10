const WebSocket = require('ws');
const { getMainWindow } = require('./windowManager');
const { ipcMain } = require('electron');
const { stat } = require('original-fs');

const PRIMARY_PORT = 8080;
const BACKUP_PORT = 8081;
let currentPort = PRIMARY_PORT;
let wsCommand = null;
let wsSound = null;
let wsCamera = null;
let reconnectTimeout = null;
const reconnectInterval = 5000;
let bufferCheckInterval = null;
let heartbeatInterval;

const state = {
    isConnectedCommand: false,
    isLonely: true,
    isSoundConnected: false,
    isCameraConnected: false,
    isReadyForNextPacket: true,
    isSoundPaused: false,
    receptionRateKbps: 0,
    onerror: false,
    isConnectingCommand: false
};

function offline() {
    console.log('Entering offline mode...');

    // Clear any active intervals
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    if (bufferCheckInterval) {
        clearInterval(bufferCheckInterval);
        bufferCheckInterval = null;
    }

    // Clean up Command WebSocket
    if (wsCommand) {
        console.log('Closing Command WebSocket...');
        try {
            wsCommand.removeAllListeners();
            if (wsCommand.readyState !== WebSocket.CLOSED) {
                wsCommand.terminate(); // Force close if not already closed
            }
        } catch (err) {
            console.error('Error closing Command WebSocket:', err);
        }
        wsCommand = null;
    }

    // Clean up Sound WebSocket
    if (wsSound) {
        console.log('Closing Sound WebSocket...');
        try {
            wsSound.removeAllListeners();
            if (wsSound.readyState !== WebSocket.CLOSED) {
                wsSound.terminate();
            }
        } catch (err) {
            console.error('Error closing Sound WebSocket:', err);
        }
        wsSound = null;
    }

    // Clean up Camera WebSocket
    if (wsCamera) {
        console.log('Closing Camera WebSocket...');
        try {
            wsCamera.removeAllListeners();
            if (wsCamera.readyState !== WebSocket.CLOSED) {
                wsCamera.terminate();
            }
        } catch (err) {
            console.error('Error closing Camera WebSocket:', err);
        }
        wsCamera = null;
    }

    // Reset state flags
    state.isLonely = true;
    state.isConnectedCommand = false;
    state.isConnectingCommand = false;
    state.isSoundConnected = false;
    state.isCameraConnected = false;

    console.log('All connections cleaned up. Attempting to reconnect...');
    
    // Directly attempt to reconnect
    connectCommand();
}


    
// Function to connect to the Command WebSocket
function connectCommand() {
    if (!state.isConnectedCommand && !state.isConnectingCommand) {
        console.log(`Attempting to connect to Command on port ${currentPort}...`);
        state.isConnectingCommand = true;    
        // Start the connection attempt
        wsCommand = new WebSocket(`ws://skuttlehost.local:${currentPort}/Command`);
        const connectTimeout = setTimeout(() => {
            if (wsCommand.readyState !== WebSocket.OPEN) {
                console.log(`Connection attempt to port ${currentPort} timed out.`);
                wsCommand.terminate(); // Forcefully close the connection attempt
                if(state.isLonely) {currentPort = (currentPort === PRIMARY_PORT) ? BACKUP_PORT : PRIMARY_PORT;}
                connectCommand();
            }
        }, 5000);
        // Attach listeners only once
        wsCommand.on('open', handleOpen);
        wsCommand.on('message', handleCommandMessage);
        wsCommand.on('close', handleClose);
        wsCommand.on('error', handleError);
    }
}

function Heartbeat() {
    clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
        // Check if WebSocket is defined and open
        if (wsCommand && wsCommand.readyState === WebSocket.OPEN) {
            if (!state.isLonely) {
                console.log("Helloooo, is anybody there?");
                wsCommand.send('ping');
                state.isLonely = true; // Assume lonely unless a response is received
            } else {
                console.log("Lost connection to Command");
                clearInterval(heartbeatInterval); // Stop the interval on lost connection
                offline(); // Handle reconnection logic
            }
        } else {
            console.log("WebSocket is not open, triggering offline...");
            clearInterval(heartbeatInterval);
            offline(); // Handle reconnection logic if the socket is not open
        }
    }, 5000);
}



function handleOpen() {
    console.log(`Connected to Command on port ${currentPort}`);
    state.isLonely = false;
    state.isConnectedCommand = true;
    state.isConnectingCommand = false;
    sendHandshake();
    Heartbeat();
    if(currentPort === PRIMARY_PORT) {
        connectSound(); 
    }
}

function handleClose() {
    console.log('Command connection closed');
    state.isLonely = true;
    state.isConnectedCommand = false;
    state.isConnectingCommand = false;
    offline();
}

function handleError(error) {
    console.error(`Command error on port ${currentPort}: ${error}`);
    state.isLonely = true;
    state.isConnectedCommand = false;
    state.isConnectingCommand = false;
    offline();
}

function handleCommandMessage(message) {
    const messageString = message.toString();
    console.log(`Command Message received: ${messageString}`);
    getMainWindow().webContents.send('triggerRX');
    clearInterval(heartbeatInterval);
    Heartbeat();
    isLonely = false;
    // Handle different types of messages
    if (messageString.startsWith('handshake,')) {
        handleHandshake(messageString);
        return;
    } else if (messageString.startsWith('heartbeat,')) {
        handleHeartbeat(messageString);
        return;
    } else if (messageString.startsWith('camconnect')) {
        connectCamera();
        return;
    } else if (messageString.startsWith('camdisconnect')) {
        disconnectCamera();
        return;
    } else if (messageString.includes('RSSI(dBm)')) {
        const rssiMatch = messageString.match(/RSSI\(dBm\): (-?\d+)/);
        if (rssiMatch) {
            const rssi = parseInt(rssiMatch[1]);
            getMainWindow().webContents.send("updateRSSI", rssi);
        }
        return;
    } else {
        console.log('Received unknown message:', messageString);
    }
}

// Function to handle handshake messages
function handleHandshake(message) {
    const [, MODULE, ID] = message.split(',');
    console.log(`Received handshake from ${MODULE}, ID: ${ID}`);
    state.isConnectedCommand = true;
    sendHandshake();
    getMainWindow().webContents.send("status", `Connected to ${MODULE}`);
}

// Function to handle heartbeat messages
function handleHeartbeat(message) {
    console.log('Heartbeat received.');
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
    console.log('Attempting to connect to Sound...');
    wsSound = new WebSocket(`ws://skuttlehost.local:${currentPort}/Sound`);

    wsSound.on('open', () => {
        console.log('Sound WebSocket connected');
        state.isSoundConnected = true;
    });


    wsSound.on('message', (message) => {
        handleSoundMessage(message, wsSound);
        getMainWindow().webContents.send('triggerRX');
    });

    wsSound.on('close', () => {
        console.log('Sound connection closed');
        clearInterval(bufferCheckInterval);
        state.isSoundConnected = false;
    });

    wsSound.on('error', (error) => {
        console.error('Sound WebSocket error:', error);
        state.isSoundConnected = false;
    });
}

// Function to connect to the Camera WebSocket
function connectCamera() {
    console.log('Attempting to connect to Camera...');
    wsCamera = new WebSocket(`ws://skuttlehost.local:${PRIMARY_PORT}/Camera`);

    wsCamera.on('open', () => {
        console.log('Camera connected');
        state.isCameraConnected = true;
        getMainWindow().webContents.send('video', 'Camera Connected');
    });

    wsCamera.on('close', () => {
        console.log('Camera connection closed');
        state.isCameraConnected = false;
        getMainWindow().webContents.send('no-video');
    });

    wsCamera.on('error', (error) => {
        console.error('Camera WebSocket error:', error);
        state.isCameraConnected = false;
    });
}

// Function to disconnect Sound
function disconnectSound() {
    if (wsSound) {
        console.log('Disconnecting Sound WebSocket...');
        wsSound.removeAllListeners();
        wsSound.close();
        wsSound = null;
    }
    clearInterval(bufferCheckInterval);
    bufferCheckInterval = null;
    state.isSoundConnected = false;
    state.isConnectingSound = false;
}

// Function to disconnect Camera
function disconnectCamera() {
    if (wsCamera) {
        console.log('Disconnecting Camera WebSocket...');
        wsCamera.removeAllListeners();
        wsCamera.close();
        wsCamera = null;
    }
    state.isCameraConnected = false;
    state.isConnectingCamera = false;
}

module.exports = {
    connectCommand,

};
