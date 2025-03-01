// basic-forum.js
// Run with: node basic-forum.js
// Then open browser to http://localhost:3000

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// In-memory storage for messages
const messages = [];
const users = new Map(); // Maps socket IDs to usernames

// Serve static HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Create HTML file content
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Olabs Community Forum</title>
  <script src="/socket.io/socket.io.js"></script>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    #message-container {
      height: 400px;
      overflow-y: auto;
      border: 1px solid #ccc;
      margin-bottom: 20px;
      padding: 10px;
    }
    .message {
      margin-bottom: 10px;
      padding: 8px;
      border-radius: 5px;
      background-color: #f1f1f1;
    }
    .message .author {
      font-weight: bold;
      margin-right: 10px;
    }
    .message .time {
      font-size: 0.8em;
      color: #666;
    }
    .user-form, .message-form {
      margin-bottom: 20px;
    }
    input, button {
      padding: 8px;
      margin-right: 5px;
    }
    #message-input {
      width: 70%;
    }
    #users-list {
      margin-bottom: 20px;
      padding: 10px;
      background-color: #f9f9f9;
      border-radius: 5px;
    }
  </style>
</head>
<body>
  <h1>Simple Community Forum</h1>
  
  <div id="users-list">
    <h3>Online Users: <span id="user-count">0</span></h3>
    <div id="users"></div>
  </div>

  <div class="user-form" id="username-form">
    <input type="text" id="username-input" placeholder="Enter your username">
    <button id="username-button">Join Forum</button>
  </div>

  <div id="message-container"></div>

  <div class="message-form" id="message-form" style="display: none;">
    <input type="text" id="message-input" placeholder="Type your message">
    <button id="send-button">Send</button>
  </div>

  <script>
    const socket = io();
    
    // Elements
    const usernameForm = document.getElementById('username-form');
    const usernameInput = document.getElementById('username-input');
    const usernameButton = document.getElementById('username-button');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const messageContainer = document.getElementById('message-container');
    const userCount = document.getElementById('user-count');
    const usersElement = document.getElementById('users');
    
    let username = '';

    // Set username
    usernameButton.addEventListener('click', () => {
      username = usernameInput.value.trim();
      if (username) {
        socket.emit('user_join', username);
        usernameForm.style.display = 'none';
        messageForm.style.display = 'block';
        messageInput.focus();
      }
    });

    // Send message
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') sendMessage();
    });

    function sendMessage() {
      const message = messageInput.value.trim();
      if (message && username) {
        socket.emit('chat_message', {
          text: message,
          author: username,
          timestamp: new Date().toISOString()
        });
        messageInput.value = '';
      }
    }

    // Display message
    function displayMessage(message) {
      const messageElement = document.createElement('div');
      messageElement.className = 'message';
      
      const time = new Date(message.timestamp).toLocaleTimeString();
      
      messageElement.innerHTML = \`
        <span class="author">\${message.author}:</span>
        <span class="content">\${message.text}</span>
        <span class="time">\${time}</span>
      \`;
      
      messageContainer.appendChild(messageElement);
      messageContainer.scrollTop = messageContainer.scrollHeight;
    }

    // Display users
    function updateUsers(users) {
      userCount.textContent = users.length;
      usersElement.innerHTML = users.map(user => \`<span>\${user}</span>\`).join(', ');
    }

    // Socket events
    socket.on('chat_history', messages => {
      messageContainer.innerHTML = '';
      messages.forEach(displayMessage);
    });

    socket.on('chat_message', message => {
      displayMessage(message);
    });

    socket.on('user_list', users => {
      updateUsers(users);
    });

    socket.on('system_message', message => {
      const messageElement = document.createElement('div');
      messageElement.className = 'message system';
      messageElement.innerHTML = \`<em>\${message}</em>\`;
      messageContainer.appendChild(messageElement);
      messageContainer.scrollTop = messageContainer.scrollHeight;
    });
  </script>
</body>
</html>
`;

// Write HTML file
const fs = require('fs');
fs.writeFileSync(path.join(__dirname, 'index.html'), htmlContent);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  
  // Send chat history to new user
  socket.emit('chat_history', messages);
  
  // User joins with username
  socket.on('user_join', (username) => {
    users.set(socket.id, username);
    
    // Broadcast system message
    const joinMessage = `${username} has joined the forum`;
    socket.broadcast.emit('system_message', joinMessage);
    
    // Update user list for all clients
    io.emit('user_list', Array.from(users.values()));
    
    console.log(`${username} joined`);
  });
  
  // Chat message received
  socket.on('chat_message', (message) => {
    console.log(`Message from ${message.author}: ${message.text}`);
    messages.push(message);
    
    // Keep only the last 100 messages
    if (messages.length > 100) {
      messages.shift();
    }
    
    // Broadcast to all clients
    io.emit('chat_message', message);
  });
  
  // User disconnects
  socket.on('disconnect', () => {
    const username = users.get(socket.id);
    if (username) {
      users.delete(socket.id);
      
      // Broadcast system message
      const leaveMessage = `${username} has left the forum`;
      io.emit('system_message', leaveMessage);
      
      // Update user list for all clients
      io.emit('user_list', Array.from(users.values()));
      
      console.log(`${username} disconnected`);
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Share this address with people on your local network to let them join');
});