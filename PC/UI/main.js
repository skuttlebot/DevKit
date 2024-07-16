// main.js *top level functionality, starts window, sets up websocket, etc
console.log('main program running');
const path = require('path');
const WebSocket = require('ws');
const AudioRecorder = require('node-audiorecorder');
const { app, BrowserWindow, ipcMain } = require('electron');
const ID = 'ROSHIE';
const SN = '001';
const DroneName = 'ANY';
const DroneSN = 'ANY';
const reconnectInterval = 5000;
const MAX_PACKET_SIZE = 1024 ;
let audioBuffer;
let offset =0;
isStreaming = false;

let reconnectTimeout;
let wsCamera; // WebSocket instance for camera
let wsCommand; // WebSocket instance for Command
let wsSound; //Websocket instance for audio
let isLonely = true; // flag indicating a recent connection used on command instance
let onerror = false;
const PRIMARY_PORT = 8080; // Primary robot server port
const BACKUP_PORT = 8081; // Backup robot server port
let audioData = null; // Declare audioData globally



const audioOptions = {
    program: process.platform === 'win32' ? 'sox' : 'arecord',
    device: null,
    bits: 16,
    channels: 2,
    rate: 44100,
    type: 'wav',
};
const audioRecorder = new AudioRecorder(audioOptions);

let currentPort = PRIMARY_PORT; // Start with primary port
let primaryServerCheckInterval;


let mainWindow;
let cameraWindowCreated  = false;
let isConnectedCommand = false;
let isSoundPaused = false;
let isReadyForNextPacket=true;


function connectCommand() {
    if (isLonely) {
        console.log(`Attempting to connect to Command...`);
        wsCommand = new WebSocket(`ws://skuttlehost.local:${currentPort}/Command`);
        if(currentPort==PRIMARY_PORT){
            connectsound();  
        }

        wsCommand.on('open', () => {
            console.log(`WebSocket Command connected on ${String(currentPort)}`);
            isLonely = false;
            onerror=false;
            clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(offline, reconnectInterval);
        });

        wsCommand.on('close', () => {
            if(!onerror){
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
            onerror= true;
            switchPortsAndReconnect();
            //reconnectTimeout = setTimeout(connectCommand, reconnectInterval);
        });

        wsCommand.on('message', (message) => {
            const messageString = message.toString();
            console.log (messageString);
            if (messageString.startsWith('handshake,')) {
                const [, MODULE, ID] = messageString.split(',');
                console.log('Received handshake from Skuttlemove');
                console.log('MODULE:', MODULE);
                console.log('ID:', ID);
                if (!isConnectedCommand) {
                    sendHandshake();
                    isConnectedCommand = true;  //handshake from server recieved.
                }
                console.log("Sending connection status to preload");
                mainWindow.webContents.send("status", `Connected!!! to ${MODULE}`);
            } else if (messageString.startsWith('heartbeat,')) {
                if (!isConnectedCommand){
                    const [, MODULE, ID] = messageString.split(',');
                    console.log('Received handshake from Skuttlemove');
                    console.log('MODULE:', MODULE);
                    console.log('ID:', ID);
                    sendHandshake();
                    isConnectedCommand = true;  //handshake from server recieved.
                    console.log("Sending connection status to preload");
                    mainWindow.webContents.send("status", `Connected!!! to ${MODULE}`); 
                }else{
                    console.log(".");
                }
            } else if (messageString.startsWith('camconnect')){
                connectcam();          
            } else if (messageString.startsWith('camdisconnect')){
                if (wsCamera) {
                    wsCamera.close();
                    console.log('Disconnected from the camera server');
                }
            } else {
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


function connectcam(){
    console.log(`Attempting to connect to Camserver...`);
        wsCamera = new WebSocket(`ws://skuttlehost.local:${PRIMARY_PORT}/Camera`);

        wsCamera.on('open', () => {
            console.log('Camera connected');
            //console.log('WebSocket Camera type:', typeof wsCamera);
        });

        wsCamera.on('close', () => {
            if(!onerror){
            console.log('Camera connection closed');       
            }
        });

        wsCamera.on('error', (error) => {

            console.error('WebSocket Camera error during connection:', error);
        });

        // Listen for messages from the camera server
        wsCamera.on('message', (data) => {
            // Assuming 'data' is binary video data received on wsCamera
            //console.log('+');
            if (mainWindow) {
                mainWindow.webContents.send('video', data);
            }

        });
}

function connectsound(){
    console.log(`Attempting to connect to audio...`);
        wsSound = new WebSocket(`ws://skuttlehost.local:${currentPort}/Sound`);

        wsSound.on('open', () => {
            console.log('Audio connected');
            //console.log('WebSocket Camera type:', typeof wsCamera);
        });

        wsSound.on('close', () => {
            if(!onerror){
            console.log('Audio connection closed');       
            }
        });

        wsSound.on('error', (error) => {

            console.error('WebSocket Audio error during connection:', error);
        });

        // Listen for messages from the audio server
        wsSound.on('message', (message) => {
            const messageString = message.toString();
            if (messageString === "PAUSE") {
                isSoundPaused = true;
                console.log("Audio streaming paused by server.");
            } else if (messageString === "RESUME") {
                isSoundPaused = false;
                console.log("Audio streaming resumed by server.");
            } else if (messageString === "READY") {
                isReadyForNextPacket = true;
            } else {
            }
            if(isReadyForNextPacket&&!isSoundPaused){sendNextPacket();} 
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
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(offline, reconnectInterval);
    }
}

function sendHandshake() {
    // Send handshake data only for wsCommand
    const handshakeData = `handshake,${ID},${SN}`;
    setTimeout(() => {
    wsCommand.send(handshakeData);
    console.log(`Sent handshake to Command:`, handshakeData);
    }, 20);
  }

//IPC communication with renderer process (renderer.js)
ipcMain.on('r2m', (event, command) => {
	//const DATA =`command,${command.commandString}`;
	const commandData = `command,${command.commandString}`;
	console.log("sent to Skuttlemove: ", commandData);
	if (isConnectedCommand) { wsCommand.send(commandData); }
});
ipcMain.on('Ready', () => {
    connectCommand();
    
});
ipcMain.on('playTone', () => {
    sendToneOverWebSocket();
});

ipcMain.on('streamToggle', () => {
    if (isStreaming) {
        stopStreaming();

    } else {
        startStreaming();
    }
})

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

app.whenReady().then(() => {
	createWindow();
	//connectCommand();
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

// Function to generate a simple tone - place this in main.js
function generateToneData(frequency = 440, duration = 1, sampleRate = 16000) {
    const samples = duration * sampleRate;
    const toneData = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
        toneData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    return toneData;
}

// Convert Float32Array to Int16Array and then to Buffer for WebSocket
function float32ToInt16Buffer(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const intVal = Math.max(-1, Math.min(1, float32Array[i])) * 0x7FFF; // Clamp values to -1 to 1
        int16Array[i] = intVal;
    }
    return Buffer.from(int16Array.buffer);
}

// Example usage: Sending a generated tone over WebSocket
function sendToneOverWebSocket() {
    offset=0;
    const toneData = generateToneData(); // Default 440Hz for 1 second
    audioData = float32ToInt16Buffer(toneData);

    if (wsSound && wsSound.readyState === WebSocket.OPEN) {
        sendNextPacket();
    } else {
        console.log('Audio data not sent, audioserver not connected.');
    }
}
function sendNextPacket() {

    if (isSoundPaused || !isReadyForNextPacket) return;
    if (offset < audioData.length) {
        const end = Math.min(offset + 1024, audioData.length); // Ensure packets are 1024 bytes
        const packet = audioData.slice(offset, end);
        wsSound.send(packet); // Send the audio data in packets
        offset += 1024;
        isReadyForNextPacket = false; // Wait for the next "READY" signal
        console.log(`Audio data packet sent, size: ${packet.length}`);
    } else {
        wsSound.send("EOA"); // Signal end of audio data
    }
}

// Start streaming audio
function startStreaming() {
    audioRecorder.start().stream().on('data', (chunk) => {
        audioBuffer = Buffer.concat([audioBuffer, chunk]); // Append new data to the buffer
        if (wsSound.readyState === WebSocket.OPEN && isReadyForNextPacket) {
            sendNextPacket(); // Send initial chunk if ready
        }
    });

    isStreaming = true;
    console.log('Audio streaming started.');
}

// Stop streaming audio
function stopStreaming() {
    audioRecorder.stop();
    isStreaming = false;
    console.log('Audio streaming stopped.');
}