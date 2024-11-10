const WebSocket = require('ws');
const { getMainWindow } = require('./windowManager');
const state = require('./config');
const AudioCapture = require('./audioCapture');

const MAX_PACKET_SIZE = 1024;
const MAX_AUDIO_BUFFER_SIZE = 2097152;
const ADAPTIVE_DELAY_STEP = 10;

let audioData = Buffer.alloc(0);
let bufferCheckInterval = null;

const audioCapture = new AudioCapture();

// Start streaming captured audio to the ESP32
function startStreaming(wsSound) {
    state.isStreaming = true;

    // Start capturing audio
    audioCapture.startCapture();

    // Listen for 'data' events emitted by audioCapture
    audioCapture.on('data', (chunk) => {
        appendToBuffer(chunk);
    });

    audioCapture.on('error', (err) => {
        console.error('Audio capture error:', err);
    });

    console.log('Audio streaming started.');
    sendNextPacket(wsSound);

    // Start buffer size check interval (every 2 seconds)
    if (!bufferCheckInterval) {
        bufferCheckInterval = setInterval(checkBufferSize, 2000);
    }
}

// Stop streaming and cleanup
function stopStreaming() {
    if (audioCapture.ffmpeg) {
        audioCapture.ffmpeg.kill('SIGKILL');
        audioCapture.ffmpeg = null;
        console.log('Audio capture stopped.');
    }
    audioCapture.removeAllListeners('data');
    state.isStreaming = false;

    console.log('Audio streaming stopped.');

    // Stop buffer size check interval
    if (bufferCheckInterval) {
        clearInterval(bufferCheckInterval);
        bufferCheckInterval = null;
    }
}

// Append new audio data (from any source) to the buffer
function appendToBuffer(chunk) {
    audioData = Buffer.concat([audioData, chunk]);
}

// Handle sending audio data over the WebSocket
function sendNextPacket(wsSound) {
    state.isPlaying = true;

    if (state.isSoundPaused || !state.isReadyForNextPacket || (state.isStreaming && audioData.length < MAX_PACKET_SIZE)) {
        setTimeout(() => sendNextPacket(wsSound), 50);
        return;
    }

    if (audioData.length >= MAX_PACKET_SIZE) {
        const packet = Buffer.from(audioData.subarray(0, MAX_PACKET_SIZE));
        audioData = Buffer.from(audioData.subarray(MAX_PACKET_SIZE));
        wsSound.send(packet);
        state.isReadyForNextPacket = false;
        getMainWindow().webContents.send('triggerTX');
    } else if (audioData.length > 0) {
        const packet = audioData;
        audioData = Buffer.alloc(0);
        wsSound.send(packet);
        state.isReadyForNextPacket = false;
        getMainWindow().webContents.send('triggerTX');
    } else if (state.isPlaying) {
        wsSound.send("EOA");
        state.isPlaying = false;
        state.isReadyForNextPacket = true;
        console.log('End of audio data sent.');
        getMainWindow().webContents.send('triggerTX');
    }
}

// Handle incoming messages from the ESP32
function handleSoundMessage(message, wsSound) {
    const messageString = message.toString();
    getMainWindow().webContents.send('triggerRX');

    if (messageString === "PAUSE") {
        state.isSoundPaused = true;
    } else if (messageString === "RESUME") {
        state.isSoundPaused = false;
        state.isReadyForNextPacket = true;
        sendNextPacket(wsSound);
    } else if (messageString === "READY") {
        state.isReadyForNextPacket = true;
        sendNextPacket(wsSound);
    } else if (messageString.startsWith('Audio Stack')) {
        const rateIndex = messageString.indexOf('Reception Rate (kbps):');
        if (rateIndex !== -1) {
            const rateString = messageString.substring(rateIndex + 23).trim();
            state.receptionRateKbps = parseFloat(rateString);
            adjustTransmissionRate();
        }
    }
}

// Check buffer size and update the UI every 2 seconds
function checkBufferSize() {
    const percentage = (audioData.length / MAX_AUDIO_BUFFER_SIZE) * 100;
    getMainWindow().webContents.send('updateFuelGauge', percentage);
    console.log(`Audio buffer size: ${audioData.length} (${percentage.toFixed(2)}%)`);
}

function adjustTransmissionRate() {
    if (state.receptionRateKbps < 60) {
        state.transmissionDelay += ADAPTIVE_DELAY_STEP;
        console.log(`Increased delay to ${state.transmissionDelay} ms.`);
    } else if (state.receptionRateKbps > 60) {
        state.transmissionDelay = Math.max(ADAPTIVE_DELAY_STEP, state.transmissionDelay - ADAPTIVE_DELAY_STEP);
        console.log(`Decreased delay to ${state.transmissionDelay} ms.`);
    }
}

function sendToneOverWebSocket(wsSound, frequency = 440, duration = 1) {
    const toneData = generateToneData(frequency, duration);
    appendToBuffer(float32ToInt16Buffer(toneData));
    sendNextPacket(wsSound);
}

function generateToneData(frequency, duration, sampleRate = 16000) {
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
        const intVal = Math.max(-1, Math.min(1, float32Array[i])) * 0x7FFF;
        int16Array[i] = intVal;
    }
    return Buffer.from(int16Array.buffer);
}

module.exports = {
    startStreaming,
    stopStreaming,
    sendNextPacket,
    handleSoundMessage,
    sendToneOverWebSocket,
    appendToBuffer,
};
