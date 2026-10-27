const { EventEmitter } = require('events');
const test = require('node:test');
const assert = require('node:assert/strict');
const { DeviceSession } = require('../PC/UI/deviceSession');

class FakeWebSocket extends EventEmitter {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 3;
    static instances = [];

    constructor(url) {
        super();
        this.url = url;
        this.readyState = FakeWebSocket.CONNECTING;
        this.sent = [];
        FakeWebSocket.instances.push(this);
    }

    send(message) {
        this.sent.push(message);
    }

    terminate() {
        this.readyState = FakeWebSocket.CLOSED;
        this.emit('close');
    }

    open() {
        this.readyState = FakeWebSocket.OPEN;
        this.emit('open');
    }
}

test('DeviceSession owns command connection and sends intents after open', () => {
    FakeWebSocket.instances = [];
    const session = new DeviceSession({
        host: 'test-device.local',
        ports: [9000],
        reconnectDelayMs: 1,
        heartbeatIntervalMs: 60_000,
        WebSocketImpl: FakeWebSocket,
    });

    session.connect();
    const socket = FakeWebSocket.instances[0];
    assert.equal(socket.url, 'ws://test-device.local:9000/Command');
    assert.equal(session.sendIntent('{"moveY":1}'), false);

    socket.open();
    assert.deepEqual(socket.sent, ['handshake,PC,SKUTTLE_UI']);
    assert.equal(session.sendIntent('{"moveY":1}'), true);
    assert.deepEqual(socket.sent, ['handshake,PC,SKUTTLE_UI', '{"moveY":1}']);

    session.close();
});
