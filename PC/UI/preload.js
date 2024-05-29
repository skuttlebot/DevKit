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
  serverURL: 'http://localhost:5400', 
  // Add any other properties/functions you want to expose
});


// Listen for messages from the main process and forward them to the renderer
ipcRenderer.on('status', (event, message) => {
    //console.log(`${message} recieved in preload`);
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'status', message } }));
});


ipcRenderer.on('video', (event, message) => {
  //console.log(`Video recieved in preload`);
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'video', message } }));
});

