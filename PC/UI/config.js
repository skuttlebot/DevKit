// config.js - Centralized application state
// Single source of truth for all runtime state across the application

module.exports = {
    // Connection states
    isConnectedCommand: false,
    isConnectingCommand: false,
    isSoundConnected: false,
    isConnectingSound: false,
    isCameraConnected: false,
    isConnectingCamera: false,
    isLonely: true,  // True if no recent heartbeat response from robot

    // WebSocket instances
    wsCommand: null,
    wsSound: null,
    wsCamera: null,

    // Audio streaming states
    isStreaming: false,
    isPlaying: false,
    isReadyForNextPacket: true,
    isSoundPaused: false,

    // Performance metrics
    receptionRateKbps: 0,
    transmissionDelay: 0,

    // Error tracking
    onerror: false
};
