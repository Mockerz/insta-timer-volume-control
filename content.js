// Content script para detectar mudanças na URL dos reels do Instagram

let lastReelUrl = null;
let reelCount = 0;
let reelHistory = []; // Histórico dos últimos 10 reels

// Função para verificar se a URL atual é de um reel
function isReelUrl(url) {
  return url.includes('/reel/') || url.includes('/reels/');
}

// Função para extrair o ID do reel da URL
function getReelId(url) {
  const match = url.match(/\/(reel|reels)\/([^\/\?]+)/);
  return match ? match[2] : null;
}

// Função para obter a contagem atual do storage
async function getReelCount() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['reelCount', 'lastReelUrl', 'reelHistory'], (result) => {
      reelCount = result.reelCount || 0;
      lastReelUrl = result.lastReelUrl || null;
      reelHistory = result.reelHistory || [];
      resolve(reelCount);
    });
  });
}

// Função para salvar a contagem
async function saveReelCount(count, url, reelId) {
  // Adiciona o reel ao histórico (máximo 10)
  if (reelId && !reelHistory.includes(reelId)) {
    reelHistory.push(reelId);
    // Mantém apenas os últimos 10
    if (reelHistory.length > 10) {
      reelHistory.shift(); // Remove o mais antigo
    }
  }
  
  chrome.storage.local.set({
    reelCount: count,
    lastReelUrl: url,
    reelHistory: reelHistory
  });
  
  // Atualiza o badge do ícone da extensão
  chrome.runtime.sendMessage({
    action: 'updateBadge',
    count: count,
    site: 'instagram'
  });
}

// Função principal para verificar mudanças de URL
async function checkReelChange() {
  const currentUrl = window.location.href;
  
  // Verifica se é uma URL de reel
  if (isReelUrl(currentUrl)) {
    await getReelCount();
    
    const reelId = getReelId(currentUrl);
    
    // Se a URL mudou E o reel não está no histórico, incrementa o contador
    if (currentUrl !== lastReelUrl && reelId && !reelHistory.includes(reelId)) {
      reelCount++;
      await saveReelCount(reelCount, currentUrl, reelId);
      console.log(`Reel detectado! Total: ${reelCount} | ID: ${reelId}`);
    } else if (reelId && reelHistory.includes(reelId)) {
      // Atualiza a URL mesmo se já foi contado (para não contar novamente)
      lastReelUrl = currentUrl;
      chrome.storage.local.set({ lastReelUrl: currentUrl });
      console.log(`Reel já contado anteriormente: ${reelId}`);
    }
  }
}

// Observa mudanças na URL usando MutationObserver e history API
let currentUrl = window.location.href;

// Monitora mudanças no histórico do navegador
window.addEventListener('popstate', () => {
  setTimeout(checkReelChange, 500);
});

// Observa mudanças no DOM que podem indicar navegação
const observer = new MutationObserver(() => {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl) {
    currentUrl = newUrl;
    setTimeout(checkReelChange, 500);
  }
});

// Inicia a observação
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Verifica quando a página carrega
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkReelChange, 1000);
  });
} else {
  setTimeout(checkReelChange, 1000);
}

// Monitora cliques em links (para detectar navegação)
document.addEventListener('click', (e) => {
  setTimeout(checkReelChange, 1000);
}, true);

// Verifica periodicamente (fallback)
setInterval(() => {
  checkReelChange();
}, 500);

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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action === 'ig_video_restart') {
    const videos = Array.from(document.querySelectorAll('video'));
    const active = getActiveVideo(videos);
    videos.forEach(v => {
      try { v.pause(); } catch (e) {}
    });
    if (active) {
      try {
        active.currentTime = 0;
        if (typeof active.play === 'function') active.play();
      } catch (e) {}
    }
  } else if (request && request.action === 'ig_video_toggle_speed') {
    const videos = Array.from(document.querySelectorAll('video'));
    const active = getActiveVideo(videos);
    let newRate = 2.0;
    if (active) {
      const current = typeof active.playbackRate === 'number' ? active.playbackRate : 1.0;
      if (current < 1.5) {
        newRate = 2.0;
      } else if (current < 2.5) {
        newRate = 3.0;
      } else {
        newRate = 1.0;
      }
      try { active.playbackRate = newRate; } catch (e) {}
      videos.forEach(v => {
        if (v !== active) {
          try { v.playbackRate = 1.0; } catch (e) {}
        }
      });
    }
    if (typeof sendResponse === 'function') {
      sendResponse({ playbackRate: newRate });
    }
  }
  return false;
});
