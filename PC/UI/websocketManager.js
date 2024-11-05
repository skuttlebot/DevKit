// websocketManager.js
const WebSocket = require('ws');
let wsCommand, wsCamera, wsSound;

function connectCommand() { /* existing connection logic here */ }
function switchPortsAndReconnect() { /* switch port logic here */ }
function startPrimaryServerCheck() { /* server check logic here */ }
function connectcam() { /* camera WebSocket logic here */ }
function connectsound() { /* sound WebSocket logic here */ }

module.exports = { connectCommand, switchPortsAndReconnect, startPrimaryServerCheck, connectcam, connectsound, wsCommand, wsCamera, wsSound };
