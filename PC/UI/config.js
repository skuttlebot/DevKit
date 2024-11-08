// config.js

module.exports = { 
    reconnectInterval: 5000,
    wsCamera: null,
    wsCommand: null,
    wsSound: null,
    currentPort: 8080,
    PRIMARY_PORT: 8080,
    BACKUP_PORT: 8081,
    reconnectTimeout: null,
    primaryServerCheckInterval: null,
    isConnectedCommand: false,
    isLonely: true,
    onerror: false,
 };