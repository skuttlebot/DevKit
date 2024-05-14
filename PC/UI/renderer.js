// renderer.js  *handles UI as well as creates and recives messages with main*
const haveEvents = "ongamepadconnected" in window;
const controllers = {};
let CSEOld = 'NULL';
let cameraWindowCreated = false;
const gamepStatusElement = document.getElementById('gamepStatus');

window.addEventListener('DOMContentLoaded', () => {
	console.log('DOMC loop started');
	let isFirstStatusUpdate = true;

	window.addEventListener('message', async (event) => {
		if (event.data.type === 'status') {
			if (isFirstStatusUpdate) {
				createCameraWindow();
				cameraWindowCreated = true;
				isFirstStatusUpdate = false;
			}
			const connectionStatusElement = document.getElementById('status');
			if (connectionStatusElement) {
				connectionStatusElement.textContent = event.data.message;
			}
		}

		if (event.data.type === 'video') {
			if (cameraWindowCreated) {
				console.log('receiving stream in the video window');
				const videoPlayer = document.getElementById('cameraFeed');
				videoPlayer.src = 'http://skuttlehost.local:81/stream';
				
				// Uncomment and adjust the following if you need to handle video blobs
				/*
				const blob = event.data;
				if (blob.type === 'video/mjpg' || blob.type === 'video/webm') {
					const videoURL = URL.createObjectURL(blob);
					console.log('Received video Blob:', videoURL);

					// Set the video source and try to play it
					videoPlayer.src = videoURL;
					videoPlayer.play().then(() => {
						console.log('Video playback started.');
					}).catch((error) => {
						console.error('Error starting video playback:', error);
					});
				} else {
					console.error('Received Blob is not a video. ' + blob.type);
				}
				*/
			}
		}
	});

	document.getElementById('playToneButton').addEventListener('click', () => {
		window.electronAPI.playTone();
	});

	electronAPI.Ready();
});

window.addEventListener("gamepadconnected", connecthandler);
window.addEventListener("gamepaddisconnected", disconnecthandler);

if (!haveEvents) {
	setInterval(scangamepads, 500);
}

function connecthandler(e) {
	addgamepad(e.gamepad);
}

function addgamepad(gamepad) {
	controllers[gamepad.index] = gamepad;

	const d = document.createElement("div");
	d.setAttribute("id", `controller${gamepad.index}`);

	const t = document.createElement("div");
	t.textContent = `Gamepad: ${gamepad.id}`;
	gamepStatusElement.textContent = t;
	d.appendChild(t);

	const b = document.createElement("ul");
	b.className = "buttons";
	gamepad.buttons.forEach((button, i) => {
		const e = document.createElement("li");
		e.className = "button";
		e.textContent = `Button ${i}`;
		b.appendChild(e);
	});

	d.appendChild(b);

	const a = document.createElement("div");
	a.className = "axes";
	gamepad.axes.forEach((axis, i) => {
		const p = document.createElement("progress");
		p.className = "axis";
		p.setAttribute("max", "2");
		p.setAttribute("value", "1");
		p.textContent = i;
		a.appendChild(p);
	});

	d.appendChild(a);

	const start = document.getElementById("start");
	if (start) {
		start.style.display = "none";
	}

	document.body.appendChild(d);
	requestAnimationFrame(updateStatus);
}

function disconnecthandler(e) {
	removegamepad(e.gamepad);
}

function removegamepad(gamepad) {
	const d = document.getElementById(`controller${gamepad.index}`);
	document.body.removeChild(d);
	gamepStatusElement.textContent = "No gamepad connected";
	delete controllers[gamepad.index];
}

function updateStatus() {
	if (!haveEvents) {
		scangamepads();
	}
	const allCommands = [];
	Object.entries(controllers).forEach(([i, controller]) => {
		const d = document.getElementById(`controller${i}`);
		const buttons = d.getElementsByClassName("button");

		controller.buttons.forEach((button, i) => {
			const b = buttons[i];
			let pressed = button === 1.0;
			let val = button;

			if (typeof button === "object") {
				pressed = val.pressed;
				val = val.value;
			}

			const pct = `${Math.round(val * 100)}%`;
			b.style.backgroundSize = `${pct} ${pct}`;
			b.textContent = pressed ? `Button ${i} [PRESSED]` : `Button ${i}`;
			b.style.color = pressed ? "#42f593" : "#2e2d33";
			b.className = pressed ? "button pressed" : "button";

			const command = pressed ? "1" : "0";
			allCommands.push(command);
		});

		const axes = d.getElementsByClassName("axis");
		controller.axes.forEach((axis, i) => {
			const a = axes[i];
			a.textContent = `${i}: ${axis.toFixed(4)}`;
			a.setAttribute("value", axis + 1);
			const command = axis.toFixed(4);
			allCommands.push(command);
		});
	});

	const commandString = allCommands.join(",");

	if (CSEOld != commandString) {
		electronAPI.RendToMain({ commandString });
		CSEOld = commandString;
	}

	requestAnimationFrame(updateStatus);
}

function scangamepads() {
	const gamepads = navigator.getGamepads();
	gamepStatusElement.style.display = gamepads.filter(Boolean).length ? "none" : "block";
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

function createCameraWindow() {
	const cameraWindow = document.getElementById('cameraWindow');
	if (cameraWindow) {
		const videoElement = document.getElementById('cameraFeed');
		if (!videoElement) {
			const newVideoElement = document.createElement("img");
			newVideoElement.id = "cameraFeed";
			newVideoElement.width = 480;
			newVideoElement.height = 360;
			cameraWindow.appendChild(newVideoElement);
		}
	}
}
