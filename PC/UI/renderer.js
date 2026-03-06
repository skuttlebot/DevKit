const haveEvents = "ongamepadconnected" in window;
const controllers = {};
let intentJSONOld = '';
let cameraWindowCreated = false;
let CAMwin = false;
let gamepStatusElement;
let Streaming = false;

// ─── Drive mode state (lives here now, not in firmware) ───────────────────────
// Mode 0: TURRET  — shoulder buttons pivot only, no stick input
// Mode 1: TANK    — left stick Y = left wheel, right stick Y = right wheel
// Mode 2: CAR     — right stick Y = forward/back, right stick X = turn
let driveMode = 0;
const DRIVE_MODE_NAMES = ['TURRET', 'TANK', 'CAR'];
let modeSwitchPending = false;
let camTogglePending  = false;

window.addEventListener('DOMContentLoaded', () => {
    console.log('DOMC loop started');
    let isFirstStatusUpdate = true;
	const cameraFeed = document.getElementById('cameraFeed');
	const placeholderImage = document.getElementById('placeholderImage');

    window.addEventListener('message', async (event) => {
        console.log('message loop started');
        if (event.data.type === 'status') {
            console.log('status loop started');
            if (isFirstStatusUpdate) {
                cameraWindowCreated = true;
                isFirstStatusUpdate = false;
            }
            let connectionStatusElement = document.getElementById('status');
            if (connectionStatusElement) {
                connectionStatusElement.textContent = event.data.message;
            }
            logEvent(event.data.message);
        }

		if (event.data.type === 'video') {
			const videoData = event.data.message;
			const liveEl = document.getElementById('liveIndicator');
			if (videoData) {
			  if (typeof videoData === 'string' && videoData.startsWith('http')) {
				cameraFeed.src = videoData;
				cameraFeed.style.display = 'block';
				placeholderImage.style.display = 'none';
				if (liveEl) liveEl.style.display = 'block';
			  } else if (videoData instanceof Uint8Array) {
				const blob = new Blob([videoData], { type: 'video/mp4' });
				const videoURL = URL.createObjectURL(blob);
				cameraFeed.src = videoURL;
				cameraFeed.style.display = 'block';
				placeholderImage.style.display = 'none';
				if (liveEl) liveEl.style.display = 'block';
			  } else {
				console.error('Unexpected video data format');
				cameraFeed.style.display = 'none';
				placeholderImage.style.display = 'block';
				if (liveEl) liveEl.style.display = 'none';
			  }
			}
		  }
		});

	window.addEventListener('no-video', () => {
		cameraFeed.style.display = 'none';
		placeholderImage.style.display = 'block';
		const liveEl = document.getElementById('liveIndicator');
		if (liveEl) liveEl.style.display = 'none';
	});

    document.getElementById('playToneButton').addEventListener('click', () => {
        window.electronAPI.playTone();
    });
    document.getElementById('streamToggleButton').addEventListener('click', () => {
        window.electronAPI.streamToggle();
        Streaming = !Streaming;
        document.getElementById('streamToggleButton').textContent = Streaming ? 'Stop Recording' : 'Start Recording';
    });

    // Drive mode buttons (sync with gamepad button 8 toggle)
    document.querySelectorAll('.mode-button').forEach(btn => {
        btn.addEventListener('click', () => {
            driveMode = parseInt(btn.dataset.mode);
            updateDriveModeUI();
            logEvent('Drive mode: ' + DRIVE_MODE_NAMES[driveMode]);
        });
    });

    // On-screen E-stop
    document.getElementById('eStopBtn').addEventListener('click', () => {
        const stopIntent = { moveX:0, moveY:0, turnZ:0, speed:1, panX:0, tiltY:0,
                             emergencyStop:true, cameraToggle:false };
        electronAPI.RendToMain(intentToJSON(stopIntent));
        logEvent('E-STOP triggered', 'error');
        triggerTX();
    });

    // On-screen camera toggle
    document.getElementById('camToggleButton').addEventListener('click', () => {
        const toggleIntent = { moveX:0, moveY:0, turnZ:0, speed:1, panX:0, tiltY:0,
                               emergencyStop:false, cameraToggle:true };
        electronAPI.RendToMain(intentToJSON(toggleIntent));
        logEvent('Camera toggle');
        triggerTX();
    });

    updateDriveModeUI();  // show initial active mode button

    window.addEventListener("gamepadconnected", connecthandler);
    window.addEventListener("gamepaddisconnected", disconnecthandler);
    electronAPI.Ready();
});

if (!haveEvents) {
	setInterval(scangamepads, 500);
}

function connecthandler(e) {
	addgamepad(e.gamepad);
}

function addgamepad(gamepad) {
	controllers[gamepad.index] = gamepad;
	logEvent('Gamepad: ' + gamepad.id.substring(0, 30), 'ok');
	const gs = document.querySelector("#gamepStatus");
	if (gs) gs.style.display = "none";
	requestAnimationFrame(updateStatus);
}

function disconnecthandler(e) {
	removegamepad(e.gamepad);
}

function removegamepad(gamepad) {
	delete controllers[gamepad.index];
	logEvent('Gamepad disconnected', 'warn');
	if (!Object.keys(controllers).length) {
		const gs = document.querySelector("#gamepStatus");
		if (gs) gs.style.display = "block";
	}
}

// ─── Intent builder ───────────────────────────────────────────────────────────
// Maps raw gamepad state + current drive mode → SkuttleIntent object.
// All motion values normalised –1.0…+1.0; the firmware applies hardware scaling.
function buildIntent(buttons, axes) {
    const intent = {
        moveX: 0, moveY: 0, turnZ: 0, speed: 1.0,
        panX: 0, tiltY: 0, emergencyStop: false, cameraToggle: false
    };

    // Emergency stop — R3 (button 11)
    if (buttons[11] && buttons[11].pressed) {
        intent.emergencyStop = true;
        return intent;
    }

    // Drive mode switch — Select/Share (button 8), toggle on release
    const modeBtn = buttons[8] && buttons[8].pressed;
    if (modeBtn && !modeSwitchPending) {
        modeSwitchPending = true;
    } else if (!modeBtn && modeSwitchPending) {
        driveMode = (driveMode + 1) % DRIVE_MODE_NAMES.length;
        logEvent('Drive mode: ' + DRIVE_MODE_NAMES[driveMode]);
        updateDriveModeUI();
        modeSwitchPending = false;
    }

    // Locomotion by mode
    if (driveMode === 0) {
        // TURRET: L1/R1 (buttons 4/5) or buttons 14/15 pivot in place
        if (buttons[15] && buttons[15].pressed) intent.turnZ =  1.0;  // CCW
        if (buttons[14] && buttons[14].pressed) intent.turnZ = -1.0;  // CW

    } else if (driveMode === 1) {
        // TANK: each stick independently drives its wheel.
        // Convert to forward+turn intent so the firmware stays wheel-agnostic.
        // ly/ry: push stick forward → axis goes negative → negate for +1 = forward
        const ly = -(axes[1] || 0);
        const ry = -(axes[3] || 0);
        intent.moveY = (ly + ry) / 2;
        intent.turnZ = (ly - ry) / 2;   // CCW positive: left wheel faster than right

    } else if (driveMode === 2) {
        // CAR: right stick. Y = forward, X = turn.
        intent.moveY = -(axes[3] || 0);  // push forward → axis –1 → intent +1
        intent.turnZ = -(axes[2] || 0);  // push right  → axis +1 → CW → intent –1
    }

    // Camera tilt: buttons 12 (up) / 13 (down)
    if (buttons[12] && buttons[12].pressed) intent.tiltY =  1.0;
    if (buttons[13] && buttons[13].pressed) intent.tiltY = -1.0;

    // Camera stream toggle: button 9, fires on release (edge detect here, not in firmware)
    const camBtn = buttons[9] && buttons[9].pressed;
    if (camBtn && !camTogglePending) {
        camTogglePending = true;
    } else if (!camBtn && camTogglePending) {
        intent.cameraToggle = true;
        camTogglePending = false;
    }

    return intent;
}

function intentToJSON(intent) {
    return JSON.stringify({
        moveX:         parseFloat(intent.moveX.toFixed(4)),
        moveY:         parseFloat(intent.moveY.toFixed(4)),
        turnZ:         parseFloat(intent.turnZ.toFixed(4)),
        speed:         parseFloat(intent.speed.toFixed(4)),
        panX:          parseFloat(intent.panX.toFixed(4)),
        tiltY:         parseFloat(intent.tiltY.toFixed(4)),
        emergencyStop: intent.emergencyStop,
        cameraToggle:  intent.cameraToggle
    });
}

// ─── Main gamepad polling loop ────────────────────────────────────────────────
function updateStatus() {
	if (!haveEvents) scangamepads();

	Object.entries(controllers).forEach(([, controller]) => {
		// Re-query for fresh data on polling browsers
		const gp = navigator.getGamepads()[controller.index] || controller;
		const intent     = buildIntent(gp.buttons, gp.axes);
		const intentJSON = intentToJSON(intent);

		updateIntentDisplay(intent);

		// Always send on cameraToggle (one-shot event); otherwise only on change
		if (intent.cameraToggle || intentJSON !== intentJSONOld) {
			electronAPI.RendToMain(intentJSON);
			triggerTX();
			intentJSONOld = intentJSON;
		}
	});

	requestAnimationFrame(updateStatus);
}

function scangamepads() {
	const gamepads = navigator.getGamepads();
	document.querySelector("#gamepStatus").style.display = gamepads.filter(Boolean)
		.length
		? "none"
		: "block";
	for (const gamepad of gamepads) {
		if (gamepad) {
			if (gamepad.index in controllers) {
				controllers[gamepad.index] = gamepad;
			} else {
				addgamepad(gamepad);
			}
		}
	}
}

function requestTonePlayback() {
    window.electronAPI.requestTonePlayback();
}

function updateBuffer() {
	if (queue.length > 0 && !buffer.updating) {
		buffer.appendBuffer(queue.shift());
	}
}

window.addEventListener('triggerTX', () => {
    triggerTX();
});

window.addEventListener('triggerRX', () => {
    triggerRX();
});

window.addEventListener('updateFuelGauge', (event) => {
    const percentage = event.detail;
    const fuelGaugeFill = document.getElementById('fuelGaugeFill');
    fuelGaugeFill.style.height = `${percentage}%`;
});

function triggerTX() {
    const ledTransmit = document.getElementById('ledTransmit');
    turnOnLED(ledTransmit);
}

function triggerRX() {
    const ledReceive = document.getElementById('ledReceive');
    turnOnLED(ledReceive);
}

function turnOnLED(ledElement, duration = 200) {
    ledElement.style.backgroundColor = '#00ff00';
    setTimeout(() => {
        ledElement.style.backgroundColor = '#333';
    }, duration);
}

function updateSignalBars(rssi) {
	const bars = document.querySelectorAll('.signal-bar');
	let strength;
	if      (rssi >= -50) strength = 5;
	else if (rssi >= -60) strength = 4;
	else if (rssi >= -70) strength = 3;
	else if (rssi >= -80) strength = 2;
	else if (rssi >= -90) strength = 1;
	else                  strength = 0;
	bars.forEach((bar, index) => {
		if (index < strength) bar.classList.add('active');
		else                  bar.classList.remove('active');
	});
}

window.addEventListener('updateRSSI', (event) => {
	updateSignalBars(event.detail);
});

// ─── Drive mode UI ────────────────────────────────────────────────────────────
function updateDriveModeUI() {
    document.querySelectorAll('.mode-button').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.mode) === driveMode);
    });
}

// ─── Intent meters ────────────────────────────────────────────────────────────
function setMeter(id, value, bipolar = true) {
    const el = document.getElementById(id);
    if (!el) return;
    if (bipolar) {
        const pct = Math.min(Math.abs(value), 1) * 50;
        if (value >= 0) {
            el.style.left       = '50%';
            el.style.width      = pct + '%';
            el.style.background = '#f39c12';
        } else {
            el.style.left       = (50 - pct) + '%';
            el.style.width      = pct + '%';
            el.style.background = '#3498db';
        }
    } else {
        el.style.width = (Math.min(Math.max(value, 0), 1) * 100) + '%';
    }
}

function updateIntentDisplay(intent) {
    setMeter('meterMoveY', intent.moveY);
    setMeter('meterTurnZ', intent.turnZ);
    setMeter('meterTiltY', intent.tiltY);
    setMeter('meterSpeed',  intent.speed, false);
}

// ─── Event log ────────────────────────────────────────────────────────────────
function logEvent(msg, level) {
    const log = document.getElementById('eventLog');
    if (!log) return;
    const now = new Date();
    const ts  = `${String(now.getHours()).padStart(2,'0')}:` +
                `${String(now.getMinutes()).padStart(2,'0')}:` +
                `${String(now.getSeconds()).padStart(2,'0')}`;
    const li  = document.createElement('li');
    li.textContent = `${ts} ${msg}`;
    if (level) li.classList.add(`event-${level}`);
    log.appendChild(li);
    while (log.children.length > 30) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
}
