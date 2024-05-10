//server
const express = require('express');
const app = express();
const port = 5400; // You can choose any available port you prefer
//const fetch = require('node-fetch');
app.use(express.json()); // Add this middleware to parse JSON data
// Endpoint to handle incoming commands from the ESP32-CAM
app.post('/command', (req, res) => {
  // Extract the command and value from the request body
  const { command } = req.body;

  // Handle the command here
  // You can control the servos or perform any other actions based on the received command

  // Respond with a success message (optional)
  res.json({ success: true });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
