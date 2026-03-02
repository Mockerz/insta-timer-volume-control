// Controle de volume flutuante para YouTube

let volumeControlEnabled = true;
let volumeLevel = 1.0;
let buttonPosition = { x: window.innerWidth - 80, y: window.innerHeight / 2 };
let isDragging = false;
let isVolumeBarOpen = false;

// Carrega configurações do storage (chaves específicas do YouTube, com fallback legado)
chrome.storage.local.get([
  'yt_volumeControlEnabled',
  'yt_volumeLevel',
  'yt_buttonPosition',
  // fallback legado
  'volumeControlEnabled',
  'volumeLevel',
  'buttonPosition'
], (result) => {
  const enabledPref = result.yt_volumeControlEnabled;
  const levelPref = result.yt_volumeLevel;
  const posPref = result.yt_buttonPosition;
  volumeControlEnabled = enabledPref !== undefined ? enabledPref : (result.volumeControlEnabled !== false);
  volumeLevel = levelPref !== undefined ? levelPref : (result.volumeLevel !== undefined ? result.volumeLevel : 1.0);
  if (posPref) {
    buttonPosition = posPref;
  } else if (result.buttonPosition) {
    buttonPosition = result.buttonPosition;
  }
  
  if (volumeControlEnabled) {
    initVolumeControl();
  }
});

// Escuta mudanças no storage
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes.yt_volumeControlEnabled || changes.volumeControlEnabled)) {
    const change = changes.yt_volumeControlEnabled || changes.volumeControlEnabled;
    volumeControlEnabled = change.newValue !== false;
    if (volumeControlEnabled) {
      if (!document.getElementById('volume-control-container')) {
        initVolumeControl();
      }
    } else {
      const container = document.getElementById('volume-control-container');
      if (container) {
        container.remove();
      }
    }
  }
});

function initVolumeControl() {
  // Remove se já existir
  const existing = document.getElementById('volume-control-container');
  if (existing) {
    existing.remove();
  }

  // Cria o container
  const container = document.createElement('div');
  container.id = 'volume-control-container';
  container.innerHTML = `
    <div id="volume-button" class="volume-button">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 9V15H7L12 20V4L7 9H3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M16.5 10.5C17.3284 11.3284 17.8284 12.3284 17.8284 13.5C17.8284 14.6716 17.3284 15.6716 16.5 16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M19.5 7.5C21.1569 9.15685 22 11.3284 22 13.5C22 15.6716 21.1569 17.8431 19.5 19.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg>
    </div>
    <div id="volume-slider-container" class="volume-slider-container">
      <div class="volume-slider-track" id="volume-slider-track">
        <div class="volume-slider-fill" id="volume-slider-fill"></div>
        <div class="volume-slider-handle" id="volume-slider-handle"></div>
      </div>
      <div class="volume-value" id="volume-value">100%</div>
    </div>
  `;

  document.body.appendChild(container);

  const button = document.getElementById('volume-button');
  const sliderContainer = document.getElementById('volume-slider-container');
  const sliderTrack = document.getElementById('volume-slider-track');
  const sliderFill = document.getElementById('volume-slider-fill');
  const sliderHandle = document.getElementById('volume-slider-handle');
  const volumeValue = document.getElementById('volume-value');

  // Aplica posição salva
  container.style.left = buttonPosition.x + 'px';
  container.style.top = buttonPosition.y + 'px';

  let isDraggingSlider = false;

  function updateVolumeDisplay(volume) {
    const percent = Math.round(volume * 100);
    volumeValue.textContent = percent + '%';
    const heightPercent = volume * 100;
    sliderFill.style.height = heightPercent + '%';
    sliderHandle.style.bottom = heightPercent + '%';
  }

  function applyVolumeToVideos(volume) {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      video.volume = volume;
    });
  }

  // Aplica volume inicial
  updateVolumeDisplay(volumeLevel);
  applyVolumeToVideos(volumeLevel);

  // Toggle barra de volume
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    isVolumeBarOpen = !isVolumeBarOpen;
    if (isVolumeBarOpen) {
      sliderContainer.style.display = 'flex';
    } else {
      sliderContainer.style.display = 'none';
    }
  });

  // Fecha ao clicar fora
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target) && isVolumeBarOpen) {
      isVolumeBarOpen = false;
      sliderContainer.style.display = 'none';
    }
  });

  // Drag and drop
  let dragStartX = 0;
  let dragStartY = 0;
  let buttonStartX = 0;
  let buttonStartY = 0;

  button.addEventListener('mousedown', (e) => {
    if (e.target.closest('#volume-slider-container')) return;
    
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = container.getBoundingClientRect();
    buttonStartX = rect.left;
    buttonStartY = rect.top;
    button.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    let newX = buttonStartX + deltaX;
    let newY = buttonStartY + deltaY;

    // Limita dentro da janela
    newX = Math.max(0, Math.min(window.innerWidth - 50, newX));
    newY = Math.max(0, Math.min(window.innerHeight - 50, newY));

    container.style.left = newX + 'px';
    container.style.top = newY + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      button.style.cursor = 'grab';
      
      // Salva posição
      const rect = container.getBoundingClientRect();
      buttonPosition = { x: rect.left, y: rect.top };
      chrome.storage.local.set({ yt_buttonPosition: buttonPosition });
    }
  });

  // Controle do slider vertical com mouse
  function handleSliderClick(e) {
    if (e.target === sliderHandle) return; // Não processa se clicou no handle
    const rect = sliderTrack.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const percent = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
    volumeLevel = percent / 100;
    updateVolumeDisplay(volumeLevel);
    applyVolumeToVideos(volumeLevel);
    chrome.storage.local.set({ yt_volumeLevel: volumeLevel });
  }

  sliderTrack.addEventListener('click', handleSliderClick);

  // Drag do handle
  sliderHandle.addEventListener('mousedown', (e) => {
    isDraggingSlider = true;
    e.stopPropagation();
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (isDraggingSlider && isVolumeBarOpen) {
      const rect = sliderTrack.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const percent = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
      volumeLevel = percent / 100;
      updateVolumeDisplay(volumeLevel);
      applyVolumeToVideos(volumeLevel);
      chrome.storage.local.set({ yt_volumeLevel: volumeLevel });
    }
  });

  document.addEventListener('mouseup', () => {
    isDraggingSlider = false;
  });

  // Observa novos vídeos adicionados à página
  const videoObserver = new MutationObserver(() => {
    if (volumeControlEnabled) {
      applyVolumeToVideos(volumeLevel);
    }
  });

  videoObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Aplica volume periodicamente (para garantir que novos vídeos recebam o volume)
  setInterval(() => {
    if (volumeControlEnabled) {
      applyVolumeToVideos(volumeLevel);
    }
  }, 1000);
}

// Adiciona estilos
const style = document.createElement('style');
style.textContent = `
  #volume-control-container {
    position: fixed;
    z-index: 999999;
    pointer-events: none;
  }

  .volume-button {
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, #FF0000 0%, #CC0000 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    pointer-events: all;
    transition: transform 0.2s ease;
  }

  .volume-button:hover {
    transform: scale(1.1);
  }

  .volume-button:active {
    cursor: grabbing;
  }

  .volume-button svg {
    width: 24px;
    height: 24px;
    color: white;
    stroke: currentColor;
  }

  .volume-slider-container {
    position: absolute;
    left: 60px;
    top: 50%;
    transform: translateY(-50%);
    display: none;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: all;
    background: rgba(26, 26, 26, 0.95);
    padding: 12px 8px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .volume-slider-track {
    width: 8px;
    height: 120px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    position: relative;
    cursor: pointer;
    overflow: visible;
  }

  .volume-slider-fill {
    position: absolute;
    bottom: 0;
    width: 100%;
    background: linear-gradient(180deg, #FF0000 0%, #CC0000 100%);
    border-radius: 4px;
    transition: height 0.05s ease;
    pointer-events: none;
  }

  .volume-slider-handle {
    position: absolute;
    left: 50%;
    transform: translate(-50%, 50%);
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    cursor: grab;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    z-index: 2;
    pointer-events: all;
    transition: transform 0.1s ease;
  }

  .volume-slider-handle:hover {
    transform: translate(-50%, 50%) scale(1.2);
  }

  .volume-slider-handle:active {
    cursor: grabbing;
    transform: translate(-50%, 50%) scale(1.1);
  }

  .volume-value {
    color: white;
    font-size: 12px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
`;
document.head.appendChild(style);
