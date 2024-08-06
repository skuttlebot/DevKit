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
  serverURL: 'http://localhost:5400', 
  // Add any other properties/functions you want to expose
});


// Listen for statusmessages from the main process and forward them to the renderer
ipcRenderer.on('status', (event, message) => {
    //console.log(`${message} recieved in preload`);
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'status', message } }));
});


ipcRenderer.on('no-video', () => {
  window.dispatchEvent(new CustomEvent('no-video'));
});

ipcRenderer.on('video', (event, message) => {
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'video', message } }));
});

ipcRenderer.on('triggerTX', () => {
  //console.log(`TriggerTX recieved in preload`);
  window.dispatchEvent(new CustomEvent('triggerTX'));
});

ipcRenderer.on('triggerRX', () => {
  //console.log(`TriggerRX recieved in preload`);
  window.dispatchEvent(new CustomEvent('triggerRX'));
});

ipcRenderer.on('updateFuelGauge', (event, percentage) => {
  console.log(`Received updateFuelGauge in preload with percentage: ${percentage}`);
  window.dispatchEvent(new CustomEvent('updateFuelGauge', { detail: percentage }));
});

ipcRenderer.on('updateRSSI', (event, rssi) => {
  window.dispatchEvent(new CustomEvent('updateRSSI', { detail: rssi }));
});