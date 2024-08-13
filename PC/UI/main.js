// main.js *top level functionality, starts window, sets up websocket, etc
console.log('main program running');
const path = require('path');
const WebSocket = require('ws');
const AudioRecorder = require('node-audiorecorder');
const { app, BrowserWindow, ipcMain } = require('electron');
const AudioCapture = require('./audioCapture');
const ID = 'ROSHIE';
const SN = '001';
const DroneName = 'ANY';
const DroneSN = 'ANY';
const reconnectInterval = 5000;
const MAX_PACKET_SIZE = 1024;
const MAX_AUDIO_BUFFER_SIZE = 2097152; // 2 MB

let isStreaming = false;
let audioData = Buffer.alloc(0);
let isSoundPaused = false;
let isReadyForNextPacket = true;
let bufferCheckInterval;
let mainWindow;
let isPlaying = false;
let transmissionDelay = 50; // Initial delay in ms
const ADAPTIVE_DELAY_STEP = 10; // Step for adaptive delay adjustment
let receptionRateKbps = 60; // Initial reception rate in kbps (from your observation)

const audioOptions = {
    program: process.platform === 'win32' ? 'sox' : 'arecord',
    device: null,
    bits: 16,
    channels: 2,
    rate: 16000,
    type: 'wav',
};
const audioRecorder = new AudioRecorder(audioOptions);
const audioCapture = new AudioCapture();

let reconnectTimeout;
let wsCamera; // WebSocket instance for camera
let wsCommand; // WebSocket instance for Command
let wsSound; //Websocket instance for audio
let isLonely = true; // flag indicating a recent connection used on command instance
let onerror = false;

const PRIMARY_PORT = 8080; // Primary robot server port
const BACKUP_PORT = 8081; // Backup robot server port

let currentPort = PRIMARY_PORT; // Start with primary port
let primaryServerCheckInterval;

let cameraWindowCreated = false;
let isConnectedCommand = false;

//IPC communication with renderer process (renderer.js)
ipcMain.on('r2m', (event, command) => {
    //const DATA =`command,${command.commandString}`;
    const commandData = `command,${command.commandString}`;
    //console.log("sent to Skuttlemove: ", commandData);
    if (isConnectedCommand) {
        wsCommand.send(commandData);
        mainWindow.webContents.send('triggerTX');
    }
});

ipcMain.on('Ready', () => {
    connectCommand();
});

ipcMain.on('playTone', () => {
    sendToneOverWebSocket(wsSound);
});

ipcMain.on('streamToggle', () => {
    if (isStreaming) {
        stopStreaming();
    } else {
        startStreaming(wsSound);
    }
})

app.whenReady().then(() => {
    createWindow();
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false, // Adjust this as needed
            allowRunningInsecureContent: true, // Adjust this as needed
            //autoplayPolicy: 'user-gesture-required', // Adjust this as needed
            media: {
                //    audioCapture: true, // Enable audio capture
                videoCapture: true, // Enable video capture
            },
        }
    });
    mainWindow.loadFile('index.html');
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function offline() {
    if (isLonely) {
        console.log('Lost Connection to Command');
        isConnectedCommand = false;
        mainWindow.webContents.send('status', 'Disconnected');
        wsCommand.close();
        clearTimeout(reconnectTimeout);
        switchPortsAndReconnect();
    } else {
        isLonely = true;
        console.log('Helloooo, is anybody there?');
        const pingMessage = 'ping';
        wsCommand.send(pingMessage);
        mainWindow.webContents.send('triggerTX');
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(offline, reconnectInterval);
    }
}

function sendHandshake() {
    // Send handshake data only for wsCommand
    const handshakeData = `handshake,${ID},${SN}`;
    setTimeout(() => {
        wsCommand.send(handshakeData);
        mainWindow.webContents.send('triggerTX');
        console.log(`Sent handshake to Command:`, handshakeData);
    }, 20);
}
    

    
// web sockets

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
                    mainWindow.webContents.send('status', 'Disconnected from Command');
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

        wsCommand.on('message', (message) => {
            mainWindow.webContents.send('triggerRX');
            const messageString = message.toString();
            console.log(messageString);
            if (messageString.startsWith('handshake,')) {
                const [, MODULE, ID] = messageString.split(',');
                console.log('Received handshake from Skuttlemove');
                console.log('MODULE:', MODULE);
                console.log('ID:', ID);
                if (!isConnectedCommand) {
                    sendHandshake();
                    isConnectedCommand = true;  //handshake from server received.
                }
                console.log("Sending connection status to preload");
                mainWindow.webContents.send("status", `Connected!!! to ${MODULE}`);
            } else if (messageString.startsWith('heartbeat,')) {
                if (!isConnectedCommand) {
                    const [, MODULE, ID] = messageString.split(',');
                    console.log('Received handshake from Skuttlemove');
                    console.log('MODULE:', MODULE);
                    console.log('ID:', ID);
                    sendHandshake();
                    isConnectedCommand = true;  //handshake from server received.
                    console.log("Sending connection status to preload");
                    mainWindow.webContents.send("status", `Connected!!! to ${MODULE}`);
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
                        mainWindow.webContents.send("updateRSSI", rssi);
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

function switchPortsAndReconnect() {
    clearTimeout(reconnectTimeout);
    currentPort = (currentPort === PRIMARY_PORT) ? BACKUP_PORT : PRIMARY_PORT;
    reconnectTimeout = setTimeout(connectCommand, reconnectInterval);
    //if(currentPort == BACKUP_PORT) startPrimaryServerCheck();
}


function startPrimaryServerCheck() {
    const checkFrequency = 20000; // Check every 10 seconds

    primaryServerCheckInterval = setInterval(() => {
        console.log('Checking primary server availability...');
        const checkWs = new WebSocket(`ws://skuttlehost.local:${PRIMARY_PORT}/health`);

        checkWs.on('open', () => {
            console.log('Primary server is back online. Considering switching back...');
            checkWs.close(); // Close the check connection immediately

            // Additional logic here to handle switching back to the primary server
            // This could involve cleanly closing the secondary connection and reconnecting to the primary
            clearInterval(primaryServerCheckInterval);
            switchPortsAndReconnect();
        });

        checkWs.on('error', (error) => {
            console.log('Primary server still unavailable:');
            // No need to switch, primary server is not available
        });
    }, checkFrequency);
}

function connectcam() {
    console.log(`Attempting to connect to Camserver...`);
    wsCamera = new WebSocket(`ws://skuttlehost.local:${PRIMARY_PORT}/Camera`);

    wsCamera.on('open', () => {
        console.log('Camera connected');
        mainWindow.webContents.send('video', 'Camera connected');
        //console.log('WebSocket Camera type:', typeof wsCamera);
    });

    wsCamera.on('close', () => {
        if (!onerror) {
            console.log('Camera connection closed');
            mainWindow.webContents.send('no-video');
        }
    });

    wsCamera.on('error', (error) => {
        console.error('WebSocket Camera error during connection:', error);
        mainWindow.webContents.send('no-video');
    });

    // Listen for messages from the camera server
    wsCamera.on('message', (data) => {
        mainWindow.webContents.send('triggerRX');
        // Assuming 'data' is binary video data received on wsCamera
        //console.log('+');
        if (mainWindow) {
            mainWindow.webContents.send('video', data);
        }
    });
}

function connectsound() {
    console.log(`Attempting to connect to audio...`);
    wsSound = new WebSocket(`ws://skuttlehost.local:${currentPort}/Sound`);

    wsSound.on('open', () => {
        console.log('Audio connected');
        //console.log('WebSocket Camera type:', typeof wsCamera);
    });

    wsSound.on('close', () => {
        if (!onerror) {
            console.log('Audio connection closed');
        }
    });

    wsSound.on('error', (error) => {
        console.error('WebSocket Audio error during connection:', error);
    });

    // Listen for messages from the audio server
    wsSound.on('message', (message) => {
        mainWindow.webContents.send('triggerRX');
        const messageString = message.toString();
        if (messageString === "PAUSE") {
            isSoundPaused = true;
            console.log("Audio streaming paused by server.");
        } else if (messageString === "RESUME") {
            isSoundPaused = false;
            console.log("Audio streaming resumed by server.");
        } else if (messageString === "READY") {
            isReadyForNextPacket = true;
            sendNextPacket(wsSound);
        } else if (messageString.startsWith('Audio Stack')) {
            const rateIndex = messageString.indexOf('Reception Rate (kbps):');
            if (rateIndex !== -1) {
                const rateString = messageString.substring(rateIndex + 23).trim();
                receptionRateKbps = parseFloat(rateString);
                adjustTransmissionAndRecordingRate();
            }
        }
    });
}


// Audio related functions

function adjustTransmissionAndRecordingRate() {
    if (receptionRateKbps < 60) {
        transmissionDelay += ADAPTIVE_DELAY_STEP;
        recordingSampleRate = Math.max(8000, recordingSampleRate - 1000); // Decrease sample rate
        console.log(`Increasing delay to ${transmissionDelay} ms and decreasing sample rate to ${recordingSampleRate} Hz`);
    } else if (receptionRateKbps > 60) {
        transmissionDelay = Math.max(ADAPTIVE_DELAY_STEP, transmissionDelay - ADAPTIVE_DELAY_STEP);
        recordingSampleRate = Math.min(44100, recordingSampleRate + 1000); // Increase sample rate
        console.log(`Decreasing delay to ${transmissionDelay} ms and increasing sample rate to ${recordingSampleRate} Hz`);
    }
    // Restart recording with the new sample rate
    restartRecording();
}

function restartRecording() {
    if (isStreaming) {
        stopStreaming();
        startStreaming(wsSound);
    }
}

function startBufferCheck() {
    if (!bufferCheckInterval) {
        bufferCheckInterval = setInterval(checkBufferSize, 500); // Check buffer size every 1/2 second
    }
}

function checkBufferSize() {
    if (audioData.length > 0) {
        const percentage = (audioData.length / MAX_AUDIO_BUFFER_SIZE) * 100;
        mainWindow.webContents.send('updateFuelGauge', percentage);
        console.log(`Audio buffer size: ${audioData.length} (${percentage.toFixed(2)}%)`);
    } else {
        clearInterval(bufferCheckInterval);
        bufferCheckInterval = null;
        isPlaying = false;
    }
}

function sendNextPacket(wsSound) {
    if (!isPlaying) {
        startBufferCheck();
        isPlaying = true;
    }
    if (isSoundPaused || !isReadyForNextPacket || (isStreaming && audioData.length < MAX_PACKET_SIZE)) {
        setTimeout(() => sendNextPacket(wsSound), 50);
        console.log('Waiting ...');
        return;
    }
    if (audioData.length >= MAX_PACKET_SIZE) {
        const packet = Buffer.from(audioData.subarray(0, MAX_PACKET_SIZE));
        audioData = Buffer.from(audioData.subarray(MAX_PACKET_SIZE));
        wsSound.send(packet);
        isReadyForNextPacket = false;
        //console.log(`Audio data packet sent, size: ${packet.length}`);
        mainWindow.webContents.send('triggerTX');
    } else if (audioData.length > 0) {
        const packet = audioData;
        audioData = Buffer.alloc(0);
        wsSound.send(packet);
        isReadyForNextPacket = false;
        //console.log(`Audio data packet sent, size: ${packet.length}`);
        mainWindow.webContents.send('triggerTX');
    } else {
        wsSound.send("EOA");
        console.log('End of audio data sent.');
        isReadyForNextPacket = true;
        mainWindow.webContents.send('triggerTX');
    }
}

function generateToneData(frequency = 440, duration = 1, sampleRate = 16000) {
    const samples = duration * sampleRate;
    const toneData = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
        toneData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    return toneData;
}

function float32ToInt16Buffer(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const intVal = Math.max(-1, Math.min(1, float32Array[i])) * 0x7FFF; // Clamp values to -1 to 1
        int16Array[i] = intVal;
    }
    return Buffer.from(int16Array.buffer);
}

function sendToneOverWebSocket(wsSound) {
    const toneData = generateToneData(); // Default 440Hz for 1 second
    audioData = float32ToInt16Buffer(toneData);

    if (wsSound && wsSound.readyState === WebSocket.OPEN) {
        sendNextPacket(wsSound);
    } else {
        console.log('Audio data not sent, audio server not connected.');
    }
}

function startStreaming(wsSound) {
    isStreaming = true;
    audioCapture.startCapture(audioOptions.rate);

    audioCapture.on('data', (chunk) => {
        audioData = Buffer.concat([audioData, chunk]);
    });

    audioCapture.on('error', (err) => {
        console.error('Audio capture error:', err);
    });

    console.log('Audio streaming started.');
    sendNextPacket(wsSound);
}

function stopStreaming() {
    audioCapture.stopCapture();
    isStreaming = false;
    console.log('Audio streaming stopped.');
}


