const socket = io.connect();

const toggleButton = document.getElementById('toggleButton');
const rtmpUrlInput = document.getElementById("rtmpUrl");
const bitrateSliderInput = document.getElementById("bitrateSlider");
const encoderSelect = document.getElementById("videoSource");
const bitrateValueSpan = document.getElementById("bitrateValue");
const audioValue = document.getElementById("audioSource");

socket.on('connect', () => {
  console.log('Connected to WebSocket server');
});

socket.on('message', (dataText) => {
  const data = JSON.parse(dataText);
  if (data.type !== 'reply') return;
  console.log('Received:', data);

  switch (data.action) {
    case "streamState":
      updateToggleButton(data.isStreaming);
      break;
    case "cpuTemperature":
      updateCpuTemperature(data);
      break;
    case "networkInfo":
      fetchNetworkInfo(data);
      break;
    case "bitrateUpdate":
      updateBitrate(data);
      break;
    case "loadConfig":
      loadConfig(data);
      break;
    case "hostUpdate":
      location.reload(true);
    case "microphoneUpdate":
      setMicrophones(data.microphones);
    case "CameraUpdate":
      setCameras(data.cameras);
    case "updateTraffic":
      updateTraffic(data.response, data.interfaceName)
  }
});

socket.on('disconnect', () => {
  console.log('Disconnected from WebSocket server');
});

socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});

function sendMessage(action, payload = {}) {
  const message = { 'type': 'message', action, ...payload };
  socket.emit('message', JSON.stringify(message));
}

function updateBitrate(data) {
  document.getElementById('currentBitrate').textContent = `${data.bitrate} kb/s`;
}

function updateCpuTemperature(data) {
  document.getElementById('cpuTemperature').innerHTML = `<p><strong>CPU Temperature:</strong> ${data.temperature}°C</p>`;
}

async function setCameras(cameras) {
  console.log(cameras)
  const videoSourceSelect = document.getElementById('videoSource');

  cameras.forEach(camera => {
    const option = document.createElement('option');
    option.value = camera.path;
    option.textContent = camera.name;
    videoSourceSelect.appendChild(option);
  });
}

async function setMicrophones(microphones) {
  const audioSourceSelect = document.getElementById('audioSource');

  microphones.forEach(microphone => {
    const option = document.createElement('option');
    option.value = microphone.path;
    option.textContent = microphone.name;
    audioSourceSelect.appendChild(option);
  });

}

async function SendUpdateTraffic() {
  const interfaces = document.querySelectorAll('.network-interface');
  for (const interface of interfaces) {
    const interfaceNameElement = interface.querySelector('strong');
    if (interfaceNameElement) {
      const interfaceName = interfaceNameElement.textContent;
      // const response = await fetch(`/networkTraffic?interface=${interfaceName}`);
      sendMessage('updateTraffic', ({ data: { interfaceName } }));
    }
  }
}

async function updateTraffic(response, interfaceName) {
  const traffic = response.traffic.tx;
  const trafficElement = document.getElementById(`traffic-${interfaceName}`);
  if (trafficElement) {
    trafficElement.textContent = `${traffic} kb/s`;
  } else {
    console.error(`Element with ID 'traffic-${interfaceName}' not found.`);
  }
}

async function fetchNetworkInfo(response) {
  try {
    const interfaces = response.data.interfaces;

    let networkInfoHTML = '';
    for (const [name, interfaceInfo] of Object.entries(interfaces)) {
      if (interfaceInfo[0].address && name !== 'lo') {
        networkInfoHTML += `<div class="network-interface">`;
        networkInfoHTML += `<input type="checkbox" name="checkbox" id="${name}" ${checkAddress(interfaceInfo)}>`;
        networkInfoHTML += `<label for="${name}"><strong>${name}</strong>: ${interfaceInfo[0].address}</label>`;
        networkInfoHTML += `<div id="traffic-${name}">0 kb/s</div>`;
        networkInfoHTML += `</div>`;
      }
    }

    const container = document.getElementById('networkInterfacesContainer');
    if (container) {
      container.innerHTML = networkInfoHTML;

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(function (checkbox) {
        checkbox.addEventListener('change', async function () {
          const atLeastOneChecked = Array.from(checkboxes).some(cb => cb.checked);
          if (!atLeastOneChecked) {
            showError("You can't disable all interfaces");
            this.checked = true;
          } else {
            await fetch(`/api/network/change?interface=${checkbox.id}&status=${this.checked}`);
            sendMessage('changeInterface', { interface: checkbox.id, status: this.checked})
            console.log(`${checkbox.id}: ${this.checked}`);
            await delay(250);
            location.reload();
          }
        });
      });

      updateNetworkInfo();
    } else {
      console.error('Element with id "networkInterfacesContainer" not found.');
    }
  } catch (error) {
    console.error('Error fetching or processing network information:', error);
  }
}

function checkAddress(interfaceInfo) {
  if (Array.isArray(interfaceInfo) && interfaceInfo.length > 0) {
    if (interfaceInfo[0].address !== 'Disabled') {
      return 'checked';
    } else {
      return '';
    }
  } else {
    return '';
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadConfig(data) {
  rtmpUrlInput.value = data.rtmpUrl;
  bitrateSliderInput.value = data.bitrate;
  encoderSelect.value = data.videoSource
  audioValue.value = data.audioSource;
  bitrateValueSpan.innerText = `${data.bitrate} kb/s`;
}

async function updateToggleButton(status) {
  toggleButton.textContent = status ? 'Stop' : 'Start';
  toggleButton.className = status ? 'stop' : 'start';
}

function toggleStream() {
  const button = document.getElementById('toggleButton');
  if (button.innerText === 'Start') {
    startStream();
    updateToggleButton(true);
  } else {
    stopStream();
    updateToggleButton(false);
  }
}

function startStream() {
  const rtmpUrl = document.getElementById('rtmpUrl').value;
  const bitrate = document.getElementById('bitrateSlider').value;
  const videoSource = document.getElementById('videoSource').value;
  const audioSource = document.getElementById('audioSource').value;

  sendMessage('start', ({ data: { rtmpUrl, bitrate, videoSource, audioSource } }));
}

function stopStream() {
  sendMessage('stop');
}

document.addEventListener('DOMContentLoaded', () => {

  fetch('/status')
    .then(response => response.json())
    .then(data => {
      if (!data.connected) {
        document.getElementById('content').style.display = 'none';
        document.getElementById('statusMessage').style.display = 'block';
      }
    }).catch(error => {
      console.error('Error fetching status:', error);
      document.getElementById('content').style.display = 'none';
      document.getElementById('statusMessage').style.display = 'block';
    });

  document.getElementById('toggleButton').addEventListener('click', toggleStream);
  document.getElementById('bitrateSlider').addEventListener('input', (event) => {
    document.getElementById('bitrateValue').innerText = `${event.target.value} kb/s`;
  });

  setInterval(function () {
    sendMessage('cpuTemperature');
    SendUpdateTraffic()
  }, 1000);

  sendMessage('streamState');
  sendMessage('cpuTemperature');
  sendMessage('networkInfo');
  sendMessage('loadConfig');
  sendMessage('microphoneUpdate');
  sendMessage('CameraUpdate');
});