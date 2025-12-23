//websocketManager.js
const WebSocket = require('ws');
const { getMainWindow } = require('./windowManager');
const { ipcMain } = require('electron');
const state = require('./config');  // Import centralized state

const PRIMARY_PORT = 8080;
const BACKUP_PORT = 8081;
let currentPort = PRIMARY_PORT;
let reconnectTimeout = null;
const RECONNECT_INTERVAL = 5000;  // Heartbeat interval in ms
let bufferCheckInterval = null;
let heartbeatInterval;

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
    if (state.wsCommand) {
        console.log('Closing Command WebSocket...');
        try {
            state.wsCommand.removeAllListeners();
            if (state.wsCommand.readyState !== WebSocket.CLOSED) {
                state.wsCommand.terminate(); // Force close if not already closed
            }
        } catch (err) {
            console.error('Error closing Command WebSocket:', err);
        }
        state.wsCommand = null;
    }

    // Clean up Sound WebSocket
    if (state.wsSound) {
        console.log('Closing Sound WebSocket...');
        try {
            state.wsSound.removeAllListeners();
            if (state.wsSound.readyState !== WebSocket.CLOSED) {
                state.wsSound.terminate();
            }
        } catch (err) {
            console.error('Error closing Sound WebSocket:', err);
        }
        state.wsSound = null;
    }

    // Clean up Camera WebSocket
    if (state.wsCamera) {
        console.log('Closing Camera WebSocket...');
        try {
            state.wsCamera.removeAllListeners();
            if (state.wsCamera.readyState !== WebSocket.CLOSED) {
                state.wsCamera.terminate();
            }
        } catch (err) {
            console.error('Error closing Camera WebSocket:', err);
        }
        state.wsCamera = null;
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
        state.wsCommand = new WebSocket(`ws://skuttlehost.local:${currentPort}/Command`);
        const connectTimeout = setTimeout(() => {
            if (state.wsCommand.readyState !== WebSocket.OPEN) {
                console.log(`Connection attempt to port ${currentPort} timed out.`);
                state.wsCommand.terminate(); // Forcefully close the connection attempt
                if(state.isLonely) {currentPort = (currentPort === PRIMARY_PORT) ? BACKUP_PORT : PRIMARY_PORT;}
                connectCommand();
            }
        }, 5000);
        // Attach listeners only once
        state.wsCommand.on('open', handleOpen);
        state.wsCommand.on('message', handleCommandMessage);
        state.wsCommand.on('close', handleClose);
        state.wsCommand.on('error', handleError);
    }
}

function Heartbeat() {
    clearInterval(heartbeatInterval);

    // Start a new heartbeat interval
    heartbeatInterval = setInterval(() => {
        if (state.wsCommand && state.wsCommand.readyState === WebSocket.OPEN) {
            if (state.isLonely) {
                // Lonely state persists, no message received during the interval
                console.log("No response received, assuming lost connection...");
                clearInterval(heartbeatInterval); // Stop the interval
                offline(); // Trigger reconnection
            } else {
                // Send a ping and set state to lonely until a response arrives
                console.log("Heloooo is anybody there?...");
                state.wsCommand.send('ping');
                state.isLonely = true; // Assume lonely until cleared
            }
        } else {
            console.log("WebSocket not open, triggering offline...");
            clearInterval(heartbeatInterval);
            offline();
        }
    }, RECONNECT_INTERVAL);
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
    console.error(`Command WebSocket error on port ${currentPort}:`, error);

    // Categorize error types for better debugging
    if (error.code === 'ECONNREFUSED') {
        console.log('Connection refused - robot may be offline or on different port');
        getMainWindow()?.webContents.send('status', 'Robot not responding...');
    } else if (error.code === 'ETIMEDOUT') {
        console.log('Connection timeout - switching ports and retrying');
        getMainWindow()?.webContents.send('status', 'Connection timeout, retrying...');
    } else if (error.code === 'ENOTFOUND') {
        console.log('Host not found - check that robot is on network');
        getMainWindow()?.webContents.send('status', 'Robot not found on network');
    } else {
        console.error('Unexpected WebSocket error:', error.message);
        getMainWindow()?.webContents.send('status', `Connection error: ${error.message}`);
    }

    state.isLonely = true;
    state.isConnectedCommand = false;
    state.isConnectingCommand = false;
    offline();
}

function handleCommandMessage(message) {
    const messageString = message.toString();
    console.log(`Command Message received: ${messageString}`);

    // Reset lonely state and restart timer
    state.isLonely = false; // Signal received, not lonely anymore
    clearInterval(heartbeatInterval); // Clear existing interval
    Heartbeat(); // Restart the heartbeat

    // Handle specific message types
    if (messageString.startsWith('handshake,')) {
        handleHandshake(messageString);
    } else if (messageString.startsWith('heartbeat,')) {
        handleHeartbeat(messageString);
    } else if (messageString.startsWith('camconnect')) {
        connectCamera();
    } else if (messageString.startsWith('camdisconnect')) {
        disconnectCamera();
    } else if (messageString.includes('RSSI(dBm)')) {
        const rssiMatch = messageString.match(/RSSI\(dBm\): (-?\d+)/);
        if (rssiMatch) {
            const rssi = parseInt(rssiMatch[1]);
            getMainWindow().webContents.send("updateRSSI", rssi);
        }
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
    if (state.wsCommand && state.wsCommand.readyState === WebSocket.OPEN) {
        console.log("Sending handshake...");
        state.wsCommand.send(handshakeData);
        getMainWindow().webContents.send('triggerTX');
    }
}

// Function to connect to the Sound WebSocket
function connectSound() {
    console.log('Attempting to connect to Sound...');
    state.wsSound = new WebSocket(`ws://skuttlehost.local:${currentPort}/Sound`);

    state.wsSound.on('open', () => {
        console.log('Sound WebSocket connected');
        state.isSoundConnected = true;
    });

    state.wsSound.on('message', (message) => {
        handleSoundMessage(message, state.wsSound);
        getMainWindow().webContents.send('triggerRX');
    });

    state.wsSound.on('close', () => {
        console.log('Sound connection closed');
        clearInterval(bufferCheckInterval);
        state.isSoundConnected = false;
    });

    state.wsSound.on('error', (error) => {
        console.error('Sound WebSocket error:', error);
        if (error.code !== 'ECONNREFUSED') {
            // Only log non-connection errors (connection errors are expected when sound isn't active)
            console.error('Sound error details:', error.message);
        }
        state.isSoundConnected = false;
    });
}

// Function to connect to the Camera WebSocket
function connectCamera() {
    console.log('Attempting to connect to Camera...');
    state.wsCamera = new WebSocket(`ws://skuttlehost.local:${PRIMARY_PORT}/Camera`);

    state.wsCamera.on('open', () => {
        console.log('Camera connected');
        state.isCameraConnected = true;
        getMainWindow().webContents.send('video', 'Camera Connected');
    });

    state.wsCamera.on('close', () => {
        console.log('Camera connection closed');
        state.isCameraConnected = false;
        getMainWindow().webContents.send('no-video');
    });

    state.wsCamera.on('error', (error) => {
        console.error('Camera WebSocket error:', error);
        if (error.code !== 'ECONNREFUSED') {
            console.error('Camera error details:', error.message);
            getMainWindow()?.webContents.send('status', 'Camera connection issue');
        }
        state.isCameraConnected = false;
        getMainWindow()?.webContents.send('no-video');
    });
}

// Function to disconnect Sound
function disconnectSound() {
    if (state.wsSound) {
        console.log('Disconnecting Sound WebSocket...');
        state.wsSound.removeAllListeners();
        state.wsSound.close();
        state.wsSound = null;
    }
    clearInterval(bufferCheckInterval);
    bufferCheckInterval = null;
    state.isSoundConnected = false;
    state.isConnectingSound = false;
}

// Function to disconnect Camera
function disconnectCamera() {
    if (state.wsCamera) {
        console.log('Disconnecting Camera WebSocket...');
        state.wsCamera.removeAllListeners();
        state.wsCamera.close();
        state.wsCamera = null;
    }
    state.isCameraConnected = false;
    state.isConnectingCamera = false;
}

module.exports = {
    connectCommand,

};
