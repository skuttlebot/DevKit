// preload.js *supports Electron's renderer functions*
const { contextBridge, ipcRenderer } = require('electron');

// Expose the 'sendCommandToMain' function to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  RendToMain: (command) => {
    ipcRenderer.send('r2m', command);
  },
  Ready: () => {
    ipcRenderer.send('Ready');
  },
  playTone: () => ipcRenderer.send('playTone'),
  streamToggle: () => ipcRenderer.send('streamToggle'),
  // Placeholder: serverURL was 'http://localhost:5400' for the unused Express server
  // This can be removed entirely or repurposed for future HTTP endpoints
});


// Listen for status messages from the main process and forward them to the renderer
ipcRenderer.on('status', (event, message) => {
    // Placeholder: console.log for debugging status messages - uncomment if needed for troubleshooting
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'status', message } }));
});

ipcRenderer.on('no-video', () => {
  window.dispatchEvent(new CustomEvent('no-video'));
});

ipcRenderer.on('video', (event, message) => {
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'video', message } }));
});

ipcRenderer.on('triggerTX', () => {
  // Placeholder: console.log for debugging TX events - uncomment if needed for troubleshooting
  window.dispatchEvent(new CustomEvent('triggerTX'));
});

ipcRenderer.on('triggerRX', () => {
  // Placeholder: console.log for debugging RX events - uncomment if needed for troubleshooting
  window.dispatchEvent(new CustomEvent('triggerRX'));
});

ipcRenderer.on('updateFuelGauge', (event, percentage) => {
  console.log(`Received updateFuelGauge in preload with percentage: ${percentage}`);
  window.dispatchEvent(new CustomEvent('updateFuelGauge', { detail: percentage }));
});

ipcRenderer.on('updateRSSI', (event, rssi) => {
  window.dispatchEvent(new CustomEvent('updateRSSI', { detail: rssi }));
});