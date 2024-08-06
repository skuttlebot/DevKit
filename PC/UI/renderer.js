const haveEvents = "ongamepadconnected" in window;
const controllers = {};
CSOld = 'NULL';
let cameraWindowCreated = false;
let CAMwin = false;
let gamepStatusElement;

let Streaming = false;

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
        }

		if (event.data.type === 'video') {
			const videoData = event.data.message;
			if (videoData) {
			  if (typeof videoData === 'string' && videoData.startsWith('http')) {
				cameraFeed.src = videoData;
				cameraFeed.style.display = 'block';
				placeholderImage.style.display = 'none';
			  } else if (videoData instanceof Uint8Array) {
				const blob = new Blob([videoData], { type: 'video/mp4' });
				const videoURL = URL.createObjectURL(blob);
				cameraFeed.src = videoURL;
				cameraFeed.style.display = 'block';
				placeholderImage.style.display = 'none';
			  } else {
				console.error('Unexpected video data format');
				cameraFeed.style.display = 'none';
				placeholderImage.style.display = 'block';
			  }
			}
		  }
		});

	window.addEventListener('no-video', () => {
		cameraFeed.style.display = 'none';
		placeholderImage.style.display = 'block';
	});

    document.getElementById('playToneButton').addEventListener('click', () => {
        window.electronAPI.playTone();
    });
    document.getElementById('streamToggleButton').addEventListener('click', () => {
        window.electronAPI.streamToggle();
        Streaming = !Streaming;
        document.getElementById('streamToggleButton').textContent = Streaming ? 'Stop Recording' : 'Start Recording';
    });

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

function addgamepad(gamepad) {  //set up the data structure for the gamepad
	controllers[gamepad.index] = gamepad;

	const d = document.createElement("div");
	d.setAttribute("id", `controller${gamepad.index}`);
	console.log("Add Gamepad: " + d);

	const t = document.createElement("div");
	t.textContent = `gamepad: ${gamepad.id}`;
	console.log("renderer sees: " + `gamepad: ${gamepad.id}`);
	//gamepStatusElement.textContent = `Connected to: ${gamepad.id}`;
	//const gamepStatusElement = document.getElementById('gamepStatus');

	const b = document.createElement("ul");
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

	const controllerOutput = document.getElementById("controllerOutput");
	if (controllerOutput) {
    	controllerOutput.innerHTML = ''; // Clear existing content
    	controllerOutput.appendChild(d); // Append 'd' to 'controllerOutput'
	}

	requestAnimationFrame(updateStatus);
}


function disconnecthandler(e) {
	removegamepad(e.gamepad);
}

function removegamepad(gamepad) {
	const d = document.getElementById(`controller${gamepad.index}`);
	console.log("Remove Triggered: " + d);
	document.getElementById("controllerOutput").removeChild(d);
	gamepStatusElement.textContent = "No gamepad connected";
	delete controllers[gamepad.index];
}


function updateStatus() {
	if (!haveEvents) {
		scangamepads();
	}
	const allCommands = []; // Array to store all the commands
	Object.entries(controllers).forEach(([i, controller]) => {

		//gamepStatusElement.textContent = `Connected to: ${controller.id}`;
		//console.log(`Connected to: ${controller.id}`);

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
	if (CSOld != commandString) {
		electronAPI.RendToMain({ commandString });
		triggerTX();
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

/*function createCameraWindow() {
	const videoElement = document.createElement("img");
	videoElement.id = "cameraFeed";
	videoElement.style.width = "480px"; // Ensure it scales to the container
	videoElement.style.height = "320px"; // Maintain aspect ratio
	cameraWindow.appendChild(videoElement);
	console.log('camera window created');
}*/

// Trigger tone generation in the main process from the renderer
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

// renderer.js

function updateSignalBars(rssi) {
	const bars = document.querySelectorAll('.signal-bar');
	let strength;
  
	if (rssi >= -50) {
	  strength = 5; // Excellent signal
	} else if (rssi >= -60) {
	  strength = 4; // Good signal
	} else if (rssi >= -70) {
	  strength = 3; // Fair signal
	} else if (rssi >= -80) {
	  strength = 2; // Weak signal
	} else if (rssi >= -90) {
	  strength = 1; // Very weak signal
	} else {
	  strength = 0; // No signal
	}
  
	bars.forEach((bar, index) => {
	  if (index < strength) {
		bar.classList.add('active');
	  } else {
		bar.classList.remove('active');
	  }
	});
  }
  
  window.addEventListener('updateRSSI', (event) => {
	const rssi = event.detail;
	updateSignalBars(rssi);
  });
  