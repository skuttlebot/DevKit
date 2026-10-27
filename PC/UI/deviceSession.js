const { EventEmitter } = require('events');
const WebSocket = require('ws');

/**
 * Owns the PC's command-channel relationship with one Skuttle gateway.
 *
 * It deliberately knows nothing about Electron, gamepads, or a particular
 * chassis. Callers provide a JSON intent string; the connected device decides
 * whether that intent drives wheels itself or relays it to an attached body.
 */
class DeviceSession extends EventEmitter {
    constructor({
        host = 'skuttlehost.local',
        ports = [8080, 8081],
        path = '/Command',
        reconnectDelayMs = 5000,
        connectTimeoutMs = 5000,
        heartbeatIntervalMs = 5000,
        WebSocketImpl = WebSocket,
    } = {}) {
        super();
        this.host = host;
        this.ports = ports;
        this.path = path;
        this.reconnectDelayMs = reconnectDelayMs;
        this.connectTimeoutMs = connectTimeoutMs;
        this.heartbeatIntervalMs = heartbeatIntervalMs;
        this.WebSocketImpl = WebSocketImpl;

        this.socket = null;
        this.portIndex = 0;
        this.reconnectTimer = null;
        this.connectTimer = null;
        this.heartbeatTimer = null;
        this.shouldReconnect = false;
        this.connected = false;
    }

    get endpoint() {
        return `ws://${this.host}:${this.ports[this.portIndex]}${this.path}`;
    }

    connect() {
        this.shouldReconnect = true;
        if (this.socket) return;
        this.#open();
    }

    close() {
        this.shouldReconnect = false;
        this.#clearTimers();
        const socket = this.socket;
        this.socket = null;
        this.connected = false;
        if (socket && socket.readyState !== this.WebSocketImpl.CLOSED) {
            socket.terminate();
        }
    }

    sendIntent(intentJSON) {
        if (!this.connected || !this.socket || this.socket.readyState !== this.WebSocketImpl.OPEN) {
            return false;
        }

        this.socket.send(intentJSON);
        this.emit('transmit', intentJSON);
        return true;
    }

    #open() {
        const endpoint = this.endpoint;
        const socket = new this.WebSocketImpl(endpoint);
        this.socket = socket;
        this.emit('status', `Connecting to ${endpoint}`);

        this.connectTimer = setTimeout(() => {
            if (this.socket === socket && socket.readyState !== this.WebSocketImpl.OPEN) {
                socket.terminate();
            }
        }, this.connectTimeoutMs);

        socket.on('open', () => this.#handleOpen(socket, endpoint));
        socket.on('message', (message) => this.#handleMessage(message));
        socket.on('close', () => this.#handleClose(socket));
        socket.on('error', (error) => this.emit('error', error));
    }

    #handleOpen(socket, endpoint) {
        if (this.socket !== socket) return;
        clearTimeout(this.connectTimer);
        this.connectTimer = null;
        this.connected = true;
        this.emit('status', `Connected to ${endpoint}`);
        this.#sendHandshake();
        this.#startHeartbeat();
    }

    #handleMessage(message) {
        const text = message.toString();
        this.emit('receive', text);

        if (text.startsWith('handshake,')) {
            const [, module, id] = text.split(',');
            this.emit('device', { module, id });
            this.emit('status', `Connected to ${module || 'Skuttle device'}`);
        } else if (text.includes('RSSI(dBm)')) {
            const match = text.match(/RSSI\(dBm\):\s*(-?\d+)/);
            if (match) this.emit('rssi', Number.parseInt(match[1], 10));
        }
    }

    #handleClose(socket) {
        if (this.socket !== socket) return;
        this.#clearTimers();
        this.socket = null;
        this.connected = false;
        this.emit('status', 'Skuttle device disconnected');

        if (!this.shouldReconnect) return;
        this.portIndex = (this.portIndex + 1) % this.ports.length;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.shouldReconnect && !this.socket) this.#open();
        }, this.reconnectDelayMs);
    }

    #sendHandshake() {
        if (!this.socket || this.socket.readyState !== this.WebSocketImpl.OPEN) return;
        this.socket.send('handshake,PC,SKUTTLE_UI');
        this.emit('transmit', 'handshake,PC,SKUTTLE_UI');
    }

    #startHeartbeat() {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
            if (!this.connected || !this.socket || this.socket.readyState !== this.WebSocketImpl.OPEN) return;
            this.socket.send('ping');
            this.emit('transmit', 'ping');
        }, this.heartbeatIntervalMs);
    }

    #clearTimers() {
        clearTimeout(this.connectTimer);
        clearTimeout(this.reconnectTimer);
        clearInterval(this.heartbeatTimer);
        this.connectTimer = null;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
    }
}

module.exports = { DeviceSession };
