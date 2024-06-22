const express = require('express');
const http = require('http');
const path = require('path');
const NodeMediaServer = require('node-media-server');
const socketIo = require('socket.io');

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    allow_origin: '*'
  }
};

let isBoxConnected = false;

const nms = new NodeMediaServer(config);
nms.run();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.get('/chart', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chart.html'));
});


app.get('/status', async (req, res) => {
  try {
    res.json({ connected: isBoxConnected });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log('New client connected');

  let isCurrentClientStreambox = false;

  socket.on('message', (message) => {
    console.log(message);
    io.emit('message', message);
  });

  socket.on('identify', (deviceName) => {
    if (deviceName === 'streambox') {
      isBoxConnected = true;
      isCurrentClientStreambox = true;
      console.log('Streambox connected');
      sendMessage('hostUpdate', { status: isBoxConnected });
    } else {
      console.log(`Unknown device connected: ${deviceName}`);
    }
  });

  socket.on('disconnect', () => {
    if (isCurrentClientStreambox) {
      isBoxConnected = false;
      console.log('Streambox disconnected');
      sendMessage('hostUpdate', { status: isBoxConnected });
    }
    console.log('Client disconnected');
  });
});

server.listen(80, () => {
  console.log(`Listening on http://localhost`);
});

function sendMessage(action, payload = {}) {
  const message = { 'type': 'reply', action, ...payload };
  io.emit('message', JSON.stringify(message));
}