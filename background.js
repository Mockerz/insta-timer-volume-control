// Background script unificado para Instagram e YouTube

const timers = {
  instagram: { startTime: null, isActive: false, total: 0 },
  youtube: { startTime: null, isActive: false, total: 0 }
};

function detectSite(url) {
  if (!url) return null;
  if (url.includes('instagram.com')) return 'instagram';
  if (url.includes('youtube.com')) return 'youtube';
  return null;
}

// Carrega os tempos totais salvos ao iniciar
chrome.storage.local.get(
  ['instagram_totalTimeSpent', 'youtube_totalTimeSpent'],
  (result) => {
    timers.instagram.total = result.instagram_totalTimeSpent || 0;
    timers.youtube.total = result.youtube_totalTimeSpent || 0;
  }
);

function saveTotalTime(site) {
  if (!timers[site]) return;
  const key = site + '_totalTimeSpent';
  chrome.storage.local.set({ [key]: timers[site].total });
}

function startTimer(site) {
  if (!timers[site]) return;
  const other = site === 'instagram' ? 'youtube' : 'instagram';
  if (!timers[site].isActive) {
    timers[site].isActive = true;
    timers[site].startTime = Date.now();
  }
  // Garante que apenas um site esteja ativo por vez
  stopTimer(other);
}

function stopTimer(site) {
  if (!timers[site]) return;
  if (timers[site].isActive && timers[site].startTime) {
    const elapsed = Math.floor((Date.now() - timers[site].startTime) / 1000);
    timers[site].total += elapsed;
    saveTotalTime(site);
    timers[site].isActive = false;
    timers[site].startTime = null;
  }
}

function stopAll() {
  stopTimer('instagram');
  stopTimer('youtube');
}

// Ativa/desativa timers conforme aba ativa
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    const site = detectSite(tab.url);
    if (site) {
      startTimer(site);
    } else {
      stopAll();
    }
  });
});

// Monitora atualizações de aba (quando URL muda)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const site = detectSite(tab.url);
    if (site) {
      // Verifica se é a aba ativa
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id === tabId) {
          startTimer(site);
        }
      });
    } else {
      stopAll();
    }
  }
});

// Para timers quando a aba é fechada
chrome.tabs.onRemoved.addListener(() => {
  stopAll();
});

// Atualiza os tempos no storage a cada segundo
setInterval(() => {
  const now = Date.now();
  const igElapsed = timers.instagram.isActive && timers.instagram.startTime
    ? Math.floor((now - timers.instagram.startTime) / 1000)
    : 0;
  const ytElapsed = timers.youtube.isActive && timers.youtube.startTime
    ? Math.floor((now - timers.youtube.startTime) / 1000)
    : 0;

  chrome.storage.local.set({
    instagram_totalTimeSpent: timers.instagram.total,
    instagram_currentSessionTime: igElapsed,
    youtube_totalTimeSpent: timers.youtube.total,
    youtube_currentSessionTime: ytElapsed
  });
}, 1000);

// Pausa quando a janela perde foco e retoma conforme site ativo
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    stopAll();
  } else {
    chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
      const tab = tabs && tabs[0];
      const site = tab ? detectSite(tab.url) : null;
      if (site) startTimer(site);
    });
  }
});

// Mensagens do popup e content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateBadge') {
    const count = request.count || 0;
    let site = request.site;
    if (!site && sender && sender.tab && sender.tab.url) {
      site = detectSite(sender.tab.url);
    }
    const color = '#E4405F';
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color });
  } else if (request.action === 'getTimeSpent') {
    const site = request.site;
    if (!site || !timers[site]) {
      sendResponse({ totalTime: 0, sessionTime: 0 });
      return true;
    }
    const elapsed = timers[site].isActive && timers[site].startTime
      ? Math.floor((Date.now() - timers[site].startTime) / 1000)
      : 0;
    sendResponse({
      totalTime: timers[site].total + elapsed,
      sessionTime: elapsed
    });
  } else if (request.action === 'resetTime') {
    const site = request.site;
    if (site && timers[site]) {
      stopTimer(site);
      timers[site].total = 0;
      saveTotalTime(site);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
  }
});

// Configura badge ao iniciar
chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    const site = tab ? detectSite(tab.url) : null;
    const storageKeys = site === 'youtube' ? ['shortsCount'] : ['reelCount'];
    chrome.storage.local.get(storageKeys, (result) => {
      const count = site === 'youtube'
        ? (result.shortsCount || 0)
        : (result.reelCount || 0);
      const color = '#E4405F';
      chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
      chrome.action.setBadgeBackgroundColor({ color });
    });
    if (site) startTimer(site);
  });
});
