const WebSocket = require('ws');
const config = require('./config');
const { getMainWindow } = require('./windowManager');
const { offline, switchPortsAndReconnect, sendHandshake } = require('./offline');
const { handleSoundMessage } = require('./audioManager');
const { ipcMain } = require('electron');

ipcMain.on('Ready', () => {
    connectCommand();
});

function connectCommand() {
    if (config.isLonely) {
        console.log(`Attempting to connect to Command...`);
        config.wsCommand = new WebSocket(`ws://localhost:${config.currentPort}/Command`);

        config.wsCommand.on('open', () => {
            console.log(`WebSocket Command connected on port ${config.currentPort}`);
            config.isLonely = false;
            config.onerror = false;
            clearTimeout(config.reconnectTimeout);
            config.reconnectTimeout = setTimeout(offline, config.reconnectInterval);
            sendHandshake();
        });

        config.wsCommand.on('close', () => {
            console.log('WebSocket Command connection closed');
            config.isConnectedCommand = false;
            config.isLonely = true;
            getMainWindow().webContents.send('status', 'Disconnected');
            config.reconnectTimeout = setTimeout(connectCommand, config.reconnectInterval);
        });

        config.wsCommand.on('error', (error) => {
            console.error('WebSocket Command error:', error);
            config.isConnectedCommand = false;
            config.isLonely = true;
            clearTimeout(config.reconnectTimeout);
            config.onerror = true;
            switchPortsAndReconnect(connectCommand);
        });

        config.wsCommand.on('message', (message) => {
            const messageString = message.toString();
            console.log("Command Message received:", messageString);
            getMainWindow().webContents.send('triggerRX');

            if (messageString.startsWith('handshake,')) {
                if (!config.isConnectedCommand) {
                    sendHandshake();
                    config.isConnectedCommand = true;
                }
                getMainWindow().webContents.send("status", "Connected");
            } else if (messageString.startsWith('camconnect')) {
                connectCamera();
            } else if (messageString.startsWith('camdisconnect')) {
                disconnectCamera();
            } else if (messageString.startsWith('soundconnect')) {
                connectSound();
            } else if (messageString.startsWith('sounddisconnect')) {
                disconnectSound();
            }
        });
    }
}

function connectCamera() {
    console.log(`Attempting to connect to Camera...`);
    config.wsCamera = new WebSocket(`ws://localhost:${config.PRIMARY_PORT}/Camera`);

    config.wsCamera.on('open', () => {
        console.log('Camera connected');
        getMainWindow().webContents.send('video', 'Camera connected');
    });

    config.wsCamera.on('close', () => {
        console.log('Camera connection closed');
        config.wsCamera = null;
        getMainWindow().webContents.send('no-video');
    });

    config.wsCamera.on('error', (error) => {
        console.error('WebSocket Camera error:', error);
    });

    config.wsCamera.on('message', (data) => {
        getMainWindow().webContents.send('video', data);
    });
}

function connectSound() {
    console.log(`Attempting to connect to Audio...`);
    config.wsSound = new WebSocket(`ws://localhost:${config.currentPort}/Sound`);

    config.wsSound.on('open', () => {
        console.log('Audio connected');
        getMainWindow().webContents.send('audio', 'Audio connected');
    });

    config.wsSound.on('close', () => {
        console.log('Audio connection closed');
        config.wsSound = null;
    });

    config.wsSound.on('error', (error) => {
        console.error('WebSocket Audio error:', error);
    });

    config.wsSound.on('message', (message) => {
        handleSoundMessage(message, config.wsSound);
    });
}

function disconnectCamera() {
    if (config.wsCamera) {
        config.wsCamera.close();
        config.wsCamera = null;
        console.log('Camera connection closed manually');
        getMainWindow().webContents.send('no-video');
    }
}

function disconnectSound() {
    if (config.wsSound) {
        config.wsSound.close();
        config.wsSound = null;
        console.log('Sound connection closed manually');
    }
}

module.exports = {
    connectCommand,
    connectCamera,
    connectSound,
    disconnectCamera,
    disconnectSound,
};
