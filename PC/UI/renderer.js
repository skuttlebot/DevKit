// renderer.js  *handles UI as well as creates and recives messages with main*
const haveEvents = "ongamepadconnected" in window;
const controllers = {};
CSOld = 'NULL';
let cameraWindowCreated = false;
let CAMwin = false;
let b;
const gamepStatusElement = document.getElementById('gamepStatus');

window.addEventListener('DOMContentLoaded', () => {
	//const connectionStatusElement = document.getElementById('status');
	console.log('DOMC loop started');
	let isFirstStatusUpdate = true;
	// Listen for messages from the main process to update the connection status
	window.addEventListener('message', async (event) => {
		console.log('message loop started');
		if (event.data.type === 'status') {
			console.log('status loop started');
			if (isFirstStatusUpdate) {
				createCameraWindow();
				cameraWindowCreated = true;
				isFirstStatusUpdate = false;
			}
			let connectionStatusElement = document.getElementById('status');
			if (connectionStatusElement) {
				connectionStatusElement.textContent = event.data.message;
			}
		}
	
		if (event.data.type === 'video') {
			
			  //console.log('Receiving video in the window');
			  const videoPlayer = document.getElementById('cameraFeed');
		
			  // Assuming 'event.data.message' contains the actual video data
			  const videoData = event.data.message;
			if (cameraWindowCreated) {
			  if (typeof videoData === 'string' && videoData.startsWith('http')) {
				// If videoData is a stream URL
				videoPlayer.src = videoData;
			  } else if (videoData instanceof Uint8Array) {
				// If videoData is binary data
				const blob = new Blob([videoData], { type: 'video/mp4' }); // Adjust MIME type if necessary
				const videoURL = URL.createObjectURL(blob);
				videoPlayer.src = videoURL;
			  } else {
				console.error('Unexpected video data format');
			  }
			}
		}
		// Initialize the UI with 'default' status
		const connectionStatusElement = document.getElementById('status');
		document.getElementById('playToneButton').addEventListener('click', () => {
			// Trigger tone playback by sending a message to the main process
			window.electronAPI.playTone();
		  });
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
	console.log("Add Gamepad: " + d);

	const t = document.createElement("div");
	t.textContent = `gamepad: ${gamepad.id}`;
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
		b.appendChild(p);
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
	console.log("Remove Triggered: " + d);
	document.body.removeChild(d);
	gamepStatusElement.textContent = "No gamepad connected";
	delete controllers[gamepad.index];
}

function updateStatus() {
	if (!haveEvents) {
		scangamepads();
	}
	const allCommands = []; // Array to store all the commands
	Object.entries(controllers).forEach(([i, controller]) => {
		const d = document.getElementById(`controller${i}`);
		const buttons = b.getElementsByClassName("button");

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

		const axes = b.getElementsByClassName("axis");
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
	if (CSOld != commandString) {
		electronAPI.RendToMain({ commandString });
		//console.log(commandString);
		CSOld = commandString;
	}

	// Update UI
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
	/*const cameraWindow = document.createElement("div");
	cameraWindow.id = "cameraWindow";
	cameraWindow.style.position = "absolute";
	cameraWindow.style.top = "50px";
	cameraWindow.style.right = "10px"; // Position the camera window in the top-right corner
	cameraWindow.style.width = "480px";
	cameraWindow.style.height = "360px";
	cameraWindow.style.border = "2px solid #ccc";
	document.body.appendChild(cameraWindow);*/

	// Add the video element to the camera window
	const videoElement = document.createElement("img");
	videoElement.id = "cameraFeed";
	//videoElement.className = "camera-off";
	videoElement.width = "480";
	videoElement.height = "360";
	//videoElement.crossOrigin = "anonymous"
	//videoElement.src = 'http://skuttlehost.local:81/stream';
	//videoElement.autoplay = true;
	//videoElement.type = "video/mp4";
	cameraWindow.appendChild(videoElement);
}

// Trigger tone generation in the main process from the renderer
function requestTonePlayback() {
    window.electronAPI.requestTonePlayback();
}


function updateBuffer() {
	if (queue.length > 0 && !buffer.updating) {
		buffer.appendBuffer(queue.shift());
	}
}

