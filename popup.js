function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  const s = String(secs).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

document.addEventListener('DOMContentLoaded', () => {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const panels = {
    instagram: document.querySelector('.panel-instagram'),
    youtube: document.querySelector('.panel-youtube')
  };
  let currentSite = 'instagram';

  const ig = {
    count: document.getElementById('ig_reelCount'),
    total: document.getElementById('ig_totalTime'),
    session: document.getElementById('ig_sessionTime'),
    resetBtn: document.getElementById('ig_resetBtn'),
    toggle: document.getElementById('ig_volumeControlToggle'),
    restartToggle: document.getElementById('ig_restartToggle'),
    speedToggle: document.getElementById('ig_speedToggle'),
    restartBtn: document.getElementById('ig_restartVideoBtn'),
    speedBtn: document.getElementById('ig_speed2xBtn')
  };
  const yt = {
    count: document.getElementById('yt_shortsCount'),
    total: document.getElementById('yt_totalTime'),
    session: document.getElementById('yt_sessionTime'),
    resetBtn: document.getElementById('yt_resetBtn'),
    toggle: document.getElementById('yt_volumeControlToggle')
  };

  function selectSite(site) {
    currentSite = site;
    tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-site') === site));
    panels.instagram.classList.toggle('active', site === 'instagram');
    panels.youtube.classList.toggle('active', site === 'youtube');
    document.body.classList.toggle('theme-yt', site === 'youtube');
  }

  tabs.forEach(t => {
    t.addEventListener('click', () => selectSite(t.getAttribute('data-site')));
  });

  function loadCounts() {
    chrome.storage.local.get(['reelCount', 'shortsCount'], (result) => {
      ig.count.textContent = (result.reelCount || 0).toLocaleString('pt-BR');
      yt.count.textContent = (result.shortsCount || 0).toLocaleString('pt-BR');
    });
  }

  function loadTimeFor(site) {
    chrome.runtime.sendMessage({ action: 'getTimeSpent', site }, (response) => {
      if (!response) return;
      if (site === 'instagram') {
        ig.total.textContent = formatTime(response.totalTime);
        ig.session.textContent = formatTime(response.sessionTime);
      } else {
        yt.total.textContent = formatTime(response.totalTime);
        yt.session.textContent = formatTime(response.sessionTime);
      }
    });
  }

  function loadAllTimes() {
    loadTimeFor('instagram');
    loadTimeFor('youtube');
  }

  function loadVolumeState() {
    chrome.storage.local.get(['ig_volumeControlEnabled', 'yt_volumeControlEnabled', 'ig_ctrl_enableRestart', 'ig_ctrl_enableSpeed'], (result) => {
      const igEnabled = result.ig_volumeControlEnabled !== false;
      const ytEnabled = result.yt_volumeControlEnabled !== false;
      ig.toggle.checked = igEnabled;
      yt.toggle.checked = ytEnabled;
      const igRestartEnabled = result.ig_ctrl_enableRestart !== false;
      const igSpeedEnabled = result.ig_ctrl_enableSpeed !== false;
      if (ig.restartToggle) ig.restartToggle.checked = igRestartEnabled;
      if (ig.speedToggle) ig.speedToggle.checked = igSpeedEnabled;
      if (ig.restartBtn) ig.restartBtn.disabled = !igRestartEnabled;
      if (ig.speedBtn) ig.speedBtn.disabled = !igSpeedEnabled;
    });
  }

  ig.resetBtn.addEventListener('click', () => {
    chrome.storage.local.set({ reelCount: 0, lastReelUrl: null, reelHistory: [] }, () => {
      ig.count.textContent = '0';
      chrome.runtime.sendMessage({ action: 'updateBadge', count: 0, site: 'instagram' });
    });
    chrome.runtime.sendMessage({ action: 'resetTime', site: 'instagram' }, () => loadTimeFor('instagram'));
  });

  yt.resetBtn.addEventListener('click', () => {
    chrome.storage.local.set({ shortsCount: 0, lastShortsUrl: null, shortsHistory: [] }, () => {
      yt.count.textContent = '0';
      chrome.runtime.sendMessage({ action: 'updateBadge', count: 0, site: 'youtube' });
    });
    chrome.runtime.sendMessage({ action: 'resetTime', site: 'youtube' }, () => loadTimeFor('youtube'));
  });

  ig.toggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    chrome.storage.local.set({ ig_volumeControlEnabled: enabled }, () => {
      chrome.tabs.query({ url: 'https://www.instagram.com/*' }, (tabs) => {
        tabs.forEach(tab => chrome.tabs.reload(tab.id));
      });
      loadVolumeState();
    });
  });

  yt.toggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    chrome.storage.local.set({ yt_volumeControlEnabled: enabled }, () => {
      chrome.tabs.query({ url: 'https://www.youtube.com/*' }, (tabs) => {
        tabs.forEach(tab => chrome.tabs.reload(tab.id));
      });
      loadVolumeState();
    });
  });

  const igRestartBtn = document.getElementById('ig_restartVideoBtn');
  const igSpeed2xBtn = document.getElementById('ig_speed2xBtn');

  function withActiveInstagramTab(fn) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabsRes) => {
      const t = tabsRes && tabsRes[0];
      if (t && t.url && t.url.includes('instagram.com')) {
        fn(t.id);
      } else {
        chrome.tabs.query({ url: 'https://www.instagram.com/*' }, (igTabs) => {
          if (igTabs && igTabs.length > 0) fn(igTabs[0].id);
        });
      }
    });
  }

  igRestartBtn.addEventListener('click', () => {
    withActiveInstagramTab((tabId) => {
      chrome.tabs.sendMessage(tabId, { action: 'ig_video_restart' });
    });
  });

  igSpeed2xBtn.addEventListener('click', () => {
    withActiveInstagramTab((tabId) => {
      chrome.tabs.sendMessage(tabId, { action: 'ig_video_toggle_speed' }, (response) => {
        const label = igSpeed2xBtn.querySelector('span:last-child');
        if (response && typeof response.playbackRate === 'number') {
          if (response.playbackRate >= 2.5) {
            label.textContent = 'Velocidade 3x';
          } else if (response.playbackRate >= 1.5) {
            label.textContent = 'Velocidade 2x';
          } else {
            label.textContent = 'Velocidade 1x';
          }
        } else {
          // Fallback: ciclo 1x -> 2x -> 3x -> 1x
          if (label.textContent.includes('1x')) {
            label.textContent = 'Velocidade 2x';
          } else if (label.textContent.includes('2x')) {
            label.textContent = 'Velocidade 3x';
          } else {
            label.textContent = 'Velocidade 1x';
          }
        }
      });
    });
  });

  if (ig.restartToggle) {
    ig.restartToggle.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      chrome.storage.local.set({ ig_ctrl_enableRestart: enabled }, () => {
        if (ig.restartBtn) ig.restartBtn.disabled = !enabled;
      });
    });
  }
  if (ig.speedToggle) {
    ig.speedToggle.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      chrome.storage.local.set({ ig_ctrl_enableSpeed: enabled }, () => {
        if (ig.speedBtn) ig.speedBtn.disabled = !enabled;
      });
    });
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabsRes) => {
    const tab = tabsRes && tabsRes[0];
    const url = tab ? tab.url || '' : '';
    const site = url.includes('youtube.com') ? 'youtube' : (url.includes('instagram.com') ? 'instagram' : 'instagram');
    selectSite(site);
    document.body.classList.toggle('theme-yt', site === 'youtube');
  });

  loadCounts();
  loadAllTimes();
  loadVolumeState();

  setInterval(() => {
    loadCounts();
    loadAllTimes();
    // Ajusta tema dinamicamente conforme seleção
    const activeSite = document.querySelector('.tab.active')?.getAttribute('data-site');
    document.body.classList.toggle('theme-yt', activeSite === 'youtube');
  }, 1000);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.reelCount || changes.shortsCount) {
      loadCounts();
    }
    if (
      changes.instagram_totalTimeSpent ||
      changes.instagram_currentSessionTime ||
      changes.youtube_totalTimeSpent ||
      changes.youtube_currentSessionTime
    ) {
      loadAllTimes();
    }
  });
});
