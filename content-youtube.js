let lastShortsUrl = null;
let shortsCount = 0;
let shortsHistory = [];

function isShortsUrl(url) {
  return url.includes('/shorts/');
}

function getShortsId(url) {
  const match = url.match(/\/shorts\/([^\/\?]+)/);
  return match ? match[1] : null;
}

async function getShortsCount() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['shortsCount', 'lastShortsUrl', 'shortsHistory'], (result) => {
      shortsCount = result.shortsCount || 0;
      lastShortsUrl = result.lastShortsUrl || null;
      shortsHistory = result.shortsHistory || [];
      resolve(shortsCount);
    });
  });
}

async function saveShortsCount(count, url, shortsId) {
  if (shortsId && !shortsHistory.includes(shortsId)) {
    shortsHistory.push(shortsId);
    if (shortsHistory.length > 10) {
      shortsHistory.shift();
    }
  }
  
  chrome.storage.local.set({
    shortsCount: count,
    lastShortsUrl: url,
    shortsHistory: shortsHistory
  });
  
  chrome.runtime.sendMessage({
    action: 'updateBadge',
    count: count,
    site: 'youtube'
  });
}

async function checkShortsChange() {
  const currentUrl = window.location.href;
  if (isShortsUrl(currentUrl)) {
    await getShortsCount();
    const shortsId = getShortsId(currentUrl);
    if (currentUrl !== lastShortsUrl && shortsId && !shortsHistory.includes(shortsId)) {
      shortsCount++;
      await saveShortsCount(shortsCount, currentUrl, shortsId);
    } else if (shortsId && shortsHistory.includes(shortsId)) {
      lastShortsUrl = currentUrl;
      chrome.storage.local.set({ lastShortsUrl: currentUrl });
    }
  }
}

let currentUrl = window.location.href;
window.addEventListener('popstate', () => setTimeout(checkShortsChange, 500));

const observer = new MutationObserver(() => {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl) {
    currentUrl = newUrl;
    setTimeout(checkShortsChange, 500);
  }
});

observer.observe(document.body, { childList: true, subtree: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(checkShortsChange, 1000));
} else {
  setTimeout(checkShortsChange, 1000);
}

document.addEventListener('click', () => setTimeout(checkShortsChange, 1000), true);
setInterval(() => { checkShortsChange(); }, 500);
