// Controle de volume flutuante para Instagram

let volumeControlEnabled = true;
let volumeLevel = 1.0;
let buttonPosition = { x: window.innerWidth - 80, y: window.innerHeight / 2 };
let isDragging = false;
let isVolumeBarOpen = false;
let igEnableRestart = true;
let igEnableSpeed = true;

// Carrega configurações do storage (chaves específicas do Instagram, com fallback legado)
chrome.storage.local.get([
  'ig_volumeControlEnabled',
  'ig_volumeLevel',
  'ig_buttonPosition',
  'ig_ctrl_enableRestart',
  'ig_ctrl_enableSpeed',
  // fallback legado
  'volumeControlEnabled',
  'volumeLevel',
  'buttonPosition'
], (result) => {
  const enabledPref = result.ig_volumeControlEnabled;
  const levelPref = result.ig_volumeLevel;
  const posPref = result.ig_buttonPosition;
  volumeControlEnabled = enabledPref !== undefined ? enabledPref : (result.volumeControlEnabled !== false);
  volumeLevel = levelPref !== undefined ? levelPref : (result.volumeLevel !== undefined ? result.volumeLevel : 1.0);
  igEnableRestart = result.ig_ctrl_enableRestart !== false;
  igEnableSpeed = result.ig_ctrl_enableSpeed !== false;
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
  if (areaName !== 'local') return;
  if (changes.ig_volumeControlEnabled || changes.volumeControlEnabled) {
    const change = changes.ig_volumeControlEnabled || changes.volumeControlEnabled;
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
  if (changes.ig_ctrl_enableRestart) {
    igEnableRestart = changes.ig_ctrl_enableRestart.newValue !== false;
    const btn = document.getElementById('ig_ctrl_restart');
    if (btn) btn.classList.toggle('disabled', !igEnableRestart);
  }
  if (changes.ig_ctrl_enableSpeed) {
    igEnableSpeed = changes.ig_ctrl_enableSpeed.newValue !== false;
    const btn = document.getElementById('ig_ctrl_speed');
    if (btn) btn.classList.toggle('disabled', !igEnableSpeed);
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
      <div class="ig-controls" id="ig-controls">
        <button class="ig-ctrl ig-restart" id="ig_ctrl_restart" title="Reiniciar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5V1L8 5L12 9V5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M4 11C4 7.13401 7.13401 4 11 4C13.1217 4 15.0783 4.84285 16.5355 6.24264" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M20 13C20 16.866 16.866 20 13 20C10.8783 20 8.92172 19.1571 7.46447 17.7574" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="ig-ctrl ig-speed" id="ig_ctrl_speed" title="Velocidade">1x</button>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  const button = document.getElementById('volume-button');
  const sliderContainer = document.getElementById('volume-slider-container');
  const sliderTrack = document.getElementById('volume-slider-track');
  const sliderFill = document.getElementById('volume-slider-fill');
  const sliderHandle = document.getElementById('volume-slider-handle');
  const volumeValue = document.getElementById('volume-value');
  const igCtrlRestart = document.getElementById('ig_ctrl_restart');
  const igCtrlSpeed = document.getElementById('ig_ctrl_speed');

  // Aplica posição salva
  function clampPosition(pos) {
    return {
      x: Math.max(0, Math.min(window.innerWidth - 50, pos.x)),
      y: Math.max(0, Math.min(window.innerHeight - 50, pos.y))
    };
  }
  const clampedPos = clampPosition(buttonPosition);
  container.style.left = clampedPos.x + 'px';
  container.style.top = clampedPos.y + 'px';

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

  function initSoundForNewVideos() {
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
      try {
        if (v.muted || v.volume === 0) {
          v.muted = false;
          if (v.volume === 0) v.volume = volumeLevel;
        }
        if (!v.dataset || v.dataset.rbSoundPlayHook !== '1') {
          const onPlayOnce = () => {
            try {
              if (v.muted || v.volume === 0) {
                v.muted = false;
                if (v.volume === 0) v.volume = volumeLevel;
              }
            } catch (e) {}
            v.removeEventListener('play', onPlayOnce);
          };
          v.addEventListener('play', onPlayOnce, { once: true });
          if (v.dataset) v.dataset.rbSoundPlayHook = '1';
        }
      } catch (e) {}
    });
  }
  const __rbIgIo = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
        const v = entry.target;
        try {
          if (v.muted || v.volume === 0) {
            v.muted = false;
            if (v.volume === 0) v.volume = volumeLevel;
          }
        } catch (e) {}
        try {
          tryClickIgUnmuteButtonsWithin(v);
        } catch (e) {}
      }
    });
  }, { threshold: [0.3] });
  function ensureIoTracking() {
    document.querySelectorAll('video').forEach(v => {
      if (!v.dataset || v.dataset.rbIoObserved !== '1') {
        __rbIgIo.observe(v);
        if (v.dataset) v.dataset.rbIoObserved = '1';
      }
    });
  }
  // Primeira rodada
  initSoundForNewVideos();
  tryClickIgUnmuteButtons();

  ensureIoTracking();

  function getActiveVideo(videos = Array.from(document.querySelectorAll('video'))) {
    if (!videos.length) return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let best = null;
    let bestArea = 0;
    videos.forEach(v => {
      const r = v.getBoundingClientRect();
      const ix = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      const iy = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      const area = ix * iy;
      if (area > bestArea) {
        bestArea = area;
        best = v;
      }
    });
    return best || videos[0] || null;
  }

  function updateSpeedLabel() {
    if (!isVolumeBarOpen) return;
    const videos = Array.from(document.querySelectorAll('video'));
    const active = getActiveVideo(videos);
    const current = active && typeof active.playbackRate === 'number' ? active.playbackRate : 1.0;
    const label = current >= 2.5 ? '3x' : (current >= 1.5 ? '2x' : '1x');
    igCtrlSpeed.textContent = label;
  }

  // Toggle barra de volume
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    isVolumeBarOpen = !isVolumeBarOpen;
    if (isVolumeBarOpen) {
      sliderContainer.style.display = 'flex';
      updateSpeedLabel();
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
      chrome.storage.local.set({ ig_buttonPosition: buttonPosition });
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
    chrome.storage.local.set({ ig_volumeLevel: volumeLevel });
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
      chrome.storage.local.set({ ig_volumeLevel: volumeLevel });
    }
  });

  document.addEventListener('mouseup', () => {
    isDraggingSlider = false;
  });

  // Controles IG: Reiniciar e Velocidade
  igCtrlRestart.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!igEnableRestart) return;
    const videos = Array.from(document.querySelectorAll('video'));
    const active = getActiveVideo(videos);
    videos.forEach(v => { try { v.pause(); } catch (err) {} });
    if (active) {
      try {
        active.currentTime = 0;
        if (typeof active.play === 'function') active.play();
      } catch (err) {}
    }
  });

  igCtrlSpeed.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!igEnableSpeed) return;
    const videos = Array.from(document.querySelectorAll('video'));
    const active = getActiveVideo(videos);
    if (active) {
      const current = typeof active.playbackRate === 'number' ? active.playbackRate : 1.0;
      let newRate = 1.0;
      if (current < 1.5) newRate = 2.0;
      else if (current < 2.5) newRate = 3.0;
      else newRate = 1.0;
      try { active.playbackRate = newRate; } catch (err) {}
      videos.forEach(v => { if (v !== active) { try { v.playbackRate = 1.0; } catch (e2) {} } });
      updateSpeedLabel();
    }
  });

  // Estados iniciais dos toggles
  igCtrlRestart.classList.toggle('disabled', !igEnableRestart);
  igCtrlSpeed.classList.toggle('disabled', !igEnableSpeed);

  // Observa novos vídeos adicionados à página
  const videoObserver = new MutationObserver(() => {
    if (volumeControlEnabled) {
      applyVolumeToVideos(volumeLevel);
    }
    initSoundForNewVideos();
    tryClickIgUnmuteButtons();
    ensureIoTracking();
    // Não recalcula velocidade em toda mutação para evitar travamentos
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
    if (isVolumeBarOpen) {
      updateSpeedLabel();
    }
    const av = getActiveVideo();
    if (av) {
      try {
        if (av.muted || av.volume === 0) {
          av.muted = false;
          if (av.volume === 0) av.volume = volumeLevel;
        }
      } catch (e) {}
      try { tryClickIgUnmuteButtonsWithin(av); } catch (e) {}
    }
  }, 1200);
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
    background: linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%);
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
    padding: 12px 10px;
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
    background: linear-gradient(180deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%);
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

  .ig-controls {
    display: flex;
    gap: 8px;
    width: 100%;
    justify-content: space-between;
    margin-top: 6px;
  }

  .ig-ctrl {
    flex: 1;
    height: 28px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.15);
    background: #2a2a2a;
    color: #e0e0e0;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, transform 0.1s ease;
  }

  .ig-ctrl:hover {
    background: #333;
    border-color: rgba(255,255,255,0.25);
    transform: translateY(-1px);
  }

  .ig-ctrl.disabled {
    opacity: 0.5;
    filter: grayscale(0.6);
    pointer-events: none;
  }

  .ig-ctrl svg {
    color: #fff;
    stroke: currentColor;
  }
`;
document.head.appendChild(style);

function tryClickIgUnmuteButtons() {
  const svgNodes = Array.from(document.querySelectorAll("button svg[aria-label], button svg title, div[role='button'] svg[aria-label], div[role='button'] svg title"));
  svgNodes.forEach(node => {
    let label = "";
    if (node.tagName.toLowerCase() === "svg") {
      label = (node.getAttribute("aria-label") || "").toLowerCase();
    } else if (node.tagName.toLowerCase() === "title") {
      label = (node.textContent || "").toLowerCase();
    }
    if (!label) return;
    const m1 = label.includes("áudio") || label.includes("audio") || label.includes("som");
    const m2 = label.includes("silenc") || label.includes("mute");
    if (!(m1 && m2)) return;
    const btn = node.closest("button, div[role='button']");
    if (!btn) return;
    const scope = btn.closest("article, div[role='dialog'], section, body");
    const v = scope ? scope.querySelector("video") : document.querySelector("video");
    if (!v) return;
    if (v.muted || v.volume === 0) {
      btn.click();
    }
  });
}

function tryClickIgUnmuteButtonsWithin(videoEl) {
  const scope = videoEl && (videoEl.closest("article, div[role='dialog'], section") || document);
  const svgNodes = Array.from(scope.querySelectorAll("button svg[aria-label], button svg title, div[role='button'] svg[aria-label], div[role='button'] svg title"));
  svgNodes.forEach(node => {
    let label = "";
    if (node.tagName.toLowerCase() === "svg") {
      label = (node.getAttribute("aria-label") || "").toLowerCase();
    } else if (node.tagName.toLowerCase() === "title") {
      label = (node.textContent || "").toLowerCase();
    }
    if (!label) return;
    const m1 = label.includes("áudio") || label.includes("audio") || label.includes("som");
    const m2 = label.includes("silenc") || label.includes("mute");
    if (!(m1 && m2)) return;
    const btn = node.closest("button, div[role='button']");
    if (!btn) return;
    const v = scope.querySelector("video");
    if (!v) return;
    if (v.muted || v.volume === 0) {
      btn.click();
    }
  });
}
