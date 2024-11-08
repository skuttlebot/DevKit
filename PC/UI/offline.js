const { getMainWindow } = require('./windowManager');
const state = require('./config');
const WebSocket = require('ws');

// Function to handle offline scenarios
function offline(connectCommand) {
    if (state.isLonely) {
        console.log('Lost Connection to Command');
        state.isConnectedCommand = false;
        getMainWindow().webContents.send('status', 'Disconnected');

        // Close the WebSocket connection if it's open
        if (state.wsCommand && state.wsCommand.readyState === WebSocket.OPEN) {
            state.wsCommand.close();
        }
        clearTimeout(state.reconnectTimeout);
        switchPortsAndReconnect(connectCommand);
    } else {
        state.isLonely = true;
        console.log('Helloooo, is anybody there?');
        const pingMessage = 'ping';

        // Send a ping message if the WebSocket is open
        if (state.wsCommand && state.wsCommand.readyState === WebSocket.OPEN) {
            state.wsCommand.send(pingMessage);
        }
        getMainWindow().webContents.send('triggerTX');

        // Set a timeout to check again after the reconnect interval
        clearTimeout(state.reconnectTimeout);
        tate.reconnectTimeout = setTimeout(() => offline(connectCommand), state.reconnectInterval);
    }
}

// Function to switch ports and reconnect
function switchPortsAndReconnect(connectCommand) {
    clearTimeout(state.reconnectTimeout);
    state.currentPort = (state.currentPort === state.PRIMARY_PORT) ? state.BACKUP_PORT : state.PRIMARY_PORT;
    console.log(`Switching ports. Now using port: ${state.currentPort}`);

    // Attempt to reconnect to the command WebSocket
    state.reconnectTimeout = setTimeout(() => connectCommand(), state.reconnectInterval);
}

// Function to periodically check if the primary server is back online
function startPrimaryServerCheck() {
    const checkFrequency = 20000; // Check every 20 seconds
    state.primaryServerCheckInterval = setInterval(() => {
        console.log('Checking primary server availability...');
        const checkWs = new WebSocket(`ws://localhost:${state.PRIMARY_PORT}/health`);

        checkWs.on('open', () => {
            console.log('Primary server is back online.');
            checkWs.close();
            clearInterval(state.primaryServerCheckInterval);
            switchPortsAndReconnect();
        });

        checkWs.on('error', () => {
            console.log('Primary server still unavailable.');
        });
    }, checkFrequency);
}

// Function to send a handshake message
function sendHandshake() {
    const handshakeData = `handshake,${state.ID},${state.SN}`;
    
    // Send the handshake only if the WebSocket is open
    if (state.wsCommand && state.wsCommand.readyState === WebSocket.OPEN) {
        state.wsCommand.send(handshakeData);
        getMainWindow().webContents.send('triggerTX');
        console.log(`Sent handshake to Command: ${handshakeData}`);
    }
}

// Import connectCommand at the end to avoid circular dependency
const { connectCommand } = require('./websocketManager');

// Export the functions
module.exports = {
    offline,
    switchPortsAndReconnect,
    startPrimaryServerCheck,
    sendHandshake
};
