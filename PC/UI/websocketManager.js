// websocketManager.js
const WebSocket = require('ws');
const { getMainWindow } = require('./windowManager');

let wsCamera;
let wsCommand;
let wsSound;

const PRIMARY_PORT = 8080;
const BACKUP_PORT = 8081;
let currentPort = PRIMARY_PORT;
let reconnectTimeout;
let isConnectedCommand = false;
let isLonely = true;
let onerror = false;
const reconnectInterval = 5000;

// Function to connect to the Command WebSocket

function connectCommand() {
    if (isLonely) {
        console.log(`Attempting to connect to Command...`);
        wsCommand = new WebSocket(`ws://skuttlehost.local:${currentPort}/Command`);
        if (currentPort == PRIMARY_PORT) {
            connectsound();
        }

        wsCommand.on('open', () => {
            console.log(`WebSocket Command connected on ${String(currentPort)}`);
            isLonely = false;
            onerror = false;
            clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(offline, reconnectInterval);
        });

        wsCommand.on('close', () => {
            if (!onerror) {
                console.log('WebSocket Command connection closed');
                if (isConnectedCommand) {
                    isConnectedCommand = false;
                    isLonely = true;
                    getMainWindow().webContents.send('status', 'Disconnected from Command');
                    clearTimeout(reconnectTimeout);
                    reconnectTimeout = setTimeout(connectCommand, reconnectInterval);
                }
            }
        });

        wsCommand.on('error', (error) => {
            console.error('WebSocket Command error during reconnection:', error);
            isConnectedCommand = false;
            isLonely = true;
            clearTimeout(reconnectTimeout);
            onerror = true;
            switchPortsAndReconnect();
            //reconnectTimeout = setTimeout(connectCommand, reconnectInterval);
        });

        wsCommand.on('message', (message) => { const messageString = message.toString();
            console.log(messageString);
            getMainWindow().webContents.send('triggerRX');
            console.log(" message received:", messageString);
           
            if (messageString.startsWith('handshake,')) {
                //console.log("Handshake message received:", messageString);
                const [, MODULE, ID] = messageString.split(',');
                console.log('Received handshake from Skuttlemove');
                console.log('MODULE:', MODULE);
                console.log('ID:', ID);
                if (!isConnectedCommand) {
                    sendHandshake();
                    isConnectedCommand = true;  //handshake from server received.
                }
                console.log("Sending connection status to preload");
                getMainWindow().webContents.send("status", `Connected!!! to ${MODULE}`);
            } else if (messageString.startsWith('heartbeat,')) {
                if (!isConnectedCommand) {
                    const [, MODULE, ID] = messageString.split(',');
                    console.log('Received handshake from Skuttlemove');
                    console.log('MODULE:', MODULE);
                    console.log('ID:', ID);
                    sendHandshake();
                    isConnectedCommand = true;  //handshake from server received.
                    console.log("Sending connection status to preload");
                    getMainWindow().webContents.send("status", `Connected!!! to ${MODULE}`);
                } else { console.log(".");}
            
            } else if (messageString.startsWith('camconnect')) {
                connectcam();
            } else if (messageString.startsWith('camdisconnect')) {
                if (wsCamera) {
                    wsCamera.close();
                    console.log('Disconnected from the camera server');
                }
            } else if (messageString.includes('RSSI(dBm)')) {
                const rssiMatch = messageString.match(/RSSI\(dBm\): (-?\d+)/);
                    if (rssiMatch) {
                        const rssi = parseInt(rssiMatch[1]);
                        getMainWindow().webContents.send("updateRSSI", rssi);
                }
            }else {
                //console.log('I heard:', messageString);
            }
            clearTimeout(reconnectTimeout);
            isLonely = false;
            reconnectTimeout = setTimeout(offline, reconnectInterval);

        });
    }
}

// Function to connect to the Camera WebSocket
function connectCamera() {
    console.log(`Attempting to connect to Camserver...`);
    wsCamera = new WebSocket(`ws://skuttlehost.local:${PRIMARY_PORT}/Camera`);

    wsCamera.on('open', () => {
        console.log('Camera connected');
        if (getMainWindow()) {
            getMainWindow().webContents.send('video', 'Camera connected');
        }
    });

    wsCamera.on('close', () => {
        if (!onerror && getMainWindow()) {
            console.log('Camera connection closed');
            getMainWindow().webContents.send('no-video');
        }
    });

    wsCamera.on('error', (error) => {
        console.error('WebSocket Camera error during connection:', error);
        if (getMainWindow()) {
            getMainWindow().webContents.send('no-video');
        }
    });

    wsCamera.on('message', (data) => {
        if (getMainWindow()) {
            getMainWindow().webContents.send('video', data);
        }
    });
}

// Function to connect to the Sound WebSocket
function connectSound() {
    console.log(`Attempting to connect to audio...`);
    wsSound = new WebSocket(`ws://skuttlehost.local:${currentPort}/Sound`);

    wsSound.on('open', () => {
        console.log('Audio connected');
        if (!bufferCheckInterval) {
            bufferCheckInterval = setInterval(checkBufferSize, 2000);
        }
    });

    wsSound.on('close', () => {
        if (!onerror && bufferCheckInterval) {
            console.log('Audio connection closed');
            clearInterval(bufferCheckInterval);
            bufferCheckInterval = null;
        }
    });

    wsSound.on('error', (error) => {
        console.error('WebSocket Audio error during connection:', error);
    });

    wsSound.on('message', (message) => {
        handleSoundMessage(message);
    });
}



module.exports = {
    connectCommand,
    connectCamera,
    connectSound,
    wsCamera,
    wsCommand,
    wsSound,
};
