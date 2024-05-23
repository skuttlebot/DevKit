// renderer.js  *handles UI as well as creates and recives messages with main*
const haveEvents = "ongamepadconnected" in window;
const controllers = {};
let CSOLD = 'NULL';
let cameraWindowCreated = false;
let CAMwin=false;
let b;
const gamepStatusElement = document.getElementById('gamepStatus');

function connecthandler(e) {
	addgamepad(e.gamepad);
}

function addgamepad(gamepad) {
	controllers[gamepad.index] = gamepad;

	const d = document.createElement("div");
	d.setAttribute("id", `controller${gamepad.index}`);
	console.log("Add Gamepad: " + d);

	const t = document.createElement("div");
	t.textContent = `Gamepad: ${gamepad.id}`;
	gamepStatusElement.textContent = t;
	d.appendChild(t);
	console.log(d);

	b = document.createElement("ul");
	b.className = "buttons";
	gamepad.buttons.forEach((button, i) => {
		const e = document.createElement("li");
		e.className = "button";
		e.textContent = `Button ${i}`;
		b.appendChild(e);
	});

	d.appendChild(b);
	console.log(d);

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
	const allCommands = [];// Array to store all the commands
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
			// Append the command with button state (0 or 1) to the array
			const command = pressed ? "1" : "0";
			allCommands.push(command);
		});

		const axes = d.getElementsByClassName("axis");
		controller.axes.forEach((axis, i) => {
			const a = axes[i];
			a.textContent = `${i}: ${axis.toFixed(4)}`;
			a.setAttribute("value", axis + 1);
			// Append the command with button axis value
			const command = axis.toFixed(4);
			allCommands.push(command);
		});
	});
	// Join all the commands into a single string with commas in between
	const commandString = allCommands.join(",");
	// Send the commandString to the main process or the server
	if (CSOLD != commandString) {
		electronAPI.RendToMain({ commandString });
		CSOLD = commandString;
	}
	// Update UI
	requestAnimationFrame(updateStatus);
}

function scangamepads() {
	const gamepads = navigator.getGamepads();
	gamepStatusElement.style.display = gamepads.filter(Boolean).length ? "none" : "block";
	for (const gamepad of gamepads) {
		if (gamepad) {
			// Can be null if disconnected during the session
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
			const videoElement = document.createElement("video");
			videoElement.id = "cameraFeed";
			videoElement.width = 480;
			videoElement.height = 360;
			cameraWindow.appendChild(videoElement);
		}
		videoElement.src = 'assets/camplaceholder.png';
		console.log('Placeholder image set to: ' + videoElement.src); // Add console log for debugging
	}
}


window.addEventListener("gamepadconnected", connecthandler);
window.addEventListener("gamepaddisconnected", disconnecthandler);
window.addEventListener('DOMContentLoaded', () => {
	console.log('DOMC loop started');
	// Initialize the UI with 'default' status
	let isFirstStatusUpdate = true;
	createCameraWindow();
	cameraWindowCreated = true;
	// Listen for messages from the main process to update the connection status
	window.addEventListener('message', async (event) => {
		if (event.data.type === 'status') {
			console.log('status loop started');
			if (isFirstStatusUpdate) {

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
				
				/* Uncomment and adjust the following if you need to handle video blobs
				videoPlayer.play()
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
		        if (event.data.type === 'video-disconnected') { // Assuming a 'video-disconnected' message is sent when the server shuts off
            if (cameraWindowCreated) {
                console.log('Video stream disconnected');
                const videoPlayer = document.getElementById('cameraFeed');
                videoPlayer.src = 'assets/camplaceholder.png'; // Switch back to placeholder image
            }
        }
	});

	document.getElementById('playToneButton').addEventListener('click', () => {
		window.electronAPI.playTone();
	});

	electronAPI.Ready();
});


if (!haveEvents) {
	setInterval(scangamepads, 500);
}





