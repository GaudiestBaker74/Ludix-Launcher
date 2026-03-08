// renderer.js — Ludix Launcher v2
// Tabs: Home | Steam | Epic (auto-detect) | Other Games (manual)

// ── Utilities ────────────────────────────────────────
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function fmtTime(mins) {
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
/** Generate a consistent gradient color from a string (for avatar fallback) */
function nameToGradient(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue},60%,25%) 0%, hsl(${(hue + 60) % 360},70%,40%) 100%)`;
}

// ── State ─────────────────────────────────────────────
let allSteamGames = [], epicGames = [], otherGames = [];
let retroCoverData = null;

let isEditing = false, editingOldName = '', editingPlatform = 'other', currentImageData = '';
let steamCacheValid = false, epicCacheValid = false, otherCacheValid = false;
let exeSuggestions = []; // populated lazily


// ── IntersectionObserver for lazy images ──────────────
const imageObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const img = entry.target;
    if (img.dataset.src) {
      img.src = img.dataset.src;
      img.onload = () => img.classList.add('loaded');
      img.onerror = () => { img.removeAttribute('src'); img.classList.add('loaded'); };
      imageObserver.unobserve(img);
    }
  });
}, { rootMargin: '200px' });

// ══════════════════════════════════════════════════════
// DOM READY
// ══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  initStatusBar();
  updateBattery();
  initLanguageSwitcher();
  applyTranslations();
  loadLastGame();
  loadTheme();

  // ── Global Sound Effects ──────────────────────────
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('button') || e.target.closest('.game-card') || e.target.closest('.exe-row')) {
      if (window.playSound) window.playSound('hover', 0.15);
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('.game-card') || e.target.closest('.exe-row')) {
      if (e.target.closest('.tab-button')) {
        if (window.playSound) window.playSound('tab', 0.4);
      } else {
        if (window.playSound) window.playSound('click', 0.3);
      }
    }
  });

  // Load all platforms in parallel
  await renderHome();
  [epicGames, allSteamGames, otherGames] = await Promise.all([
    window.electronAPI.getEpicGames(),
    window.electronAPI.getSteamGames(),
    window.electronAPI.getOtherGames()
  ]).catch(() => [[], [], []]);
  steamCacheValid = epicCacheValid = otherCacheValid = true;

  // ── Tab switching ─────────────────────────────────
  const tabButtons = document.querySelectorAll('.tab-button');
  const views = document.querySelectorAll('.platform-view');
  const underline = document.querySelector('.tab-underline');

  function setUnderline(btn) {
    const cr = document.querySelector('.tabs').getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    underline.style.width = `${btn.offsetWidth}px`;
    underline.style.transform = `translateX(${br.left - cr.left}px)`;
  }

  tabButtons.forEach(btn => btn.addEventListener('click', async () => {
    const plat = btn.dataset.platform;
    tabButtons.forEach(b => b.classList.remove('active'));
    views.forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`${plat}-view`).classList.add('active');
    setUnderline(btn);

    if (plat === 'home') {
      await renderHome();
    } else if (plat === 'steam') {
      if (!steamCacheValid) { allSteamGames = await window.electronAPI.getSteamGames(); steamCacheValid = true; }
      renderSteamGames(allSteamGames);
    } else if (plat === 'epic') {
      if (!epicCacheValid) { epicGames = await window.electronAPI.getEpicGames(); epicCacheValid = true; }
      renderEpicGames(epicGames);
    } else if (plat === 'other') {
      if (!otherCacheValid) { otherGames = await window.electronAPI.getOtherGames(); otherCacheValid = true; }
      renderOtherGames(otherGames);
    } else if (plat === 'retro') {
      await _renderRetro();
    } else if (plat === 'profile') {
      await renderProfile();
    }
  }));

  const activeTab = document.querySelector('.tab-button.active');
  if (activeTab) setUnderline(activeTab);

  // ── Steam search (debounced) ──────────────────────
  document.getElementById('searchInput')?.addEventListener('input', debounce(e => {
    const q = e.target.value.toLowerCase().trim();
    renderSteamGames(q ? allSteamGames.filter(g => g.name.toLowerCase().includes(q)) : allSteamGames);
  }, 300));

  // ── Settings & Themes ─────────────────────────────────
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      settingsModal.style.display = 'flex';
    });
  }

  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });
  }

  function loadTheme() {
    let t;
    const raw = localStorage.getItem('ludix_theme');
    try {
      t = JSON.parse(raw || '{"accent":"#4fc3f7", "blur":"10", "perf":false}');
      // Also handle case where someone manually set 'raw' to a string that is valid JSON but not an object
      if (typeof t !== 'object' || t === null) throw new Error('Not an object');
    } catch (e) {
      // Handle legacy color strings like "gold" or "#4fc3f7"
      t = { accent: raw || "#4fc3f7", blur: "10", perf: false };
    }

    document.documentElement.style.setProperty('--accent', t.accent);
    document.documentElement.style.setProperty('--card-border', `${t.accent}40`);

    const blurValue = t.perf ? '0px' : `${t.blur || '10'}px`;
    document.documentElement.style.setProperty('--panel-blur', blurValue);

    const accEl = document.getElementById('themeAccent');
    if (accEl) accEl.value = t.accent;
    const blurEl = document.getElementById('themeBlur');
    if (blurEl) blurEl.value = t.blur || '10';
    const perfEl = document.getElementById('themePerf');
    if (perfEl) perfEl.checked = !!t.perf;

    const canvas = document.getElementById('bgCanvas');
    if (canvas) {
      canvas.style.display = t.perf ? 'none' : 'block';
    }
  }

  function saveTheme() {
    const accent = document.getElementById('themeAccent').value;
    const blur = document.getElementById('themeBlur').value;
    const perf = document.getElementById('themePerf').checked;

    localStorage.setItem('ludix_theme', JSON.stringify({ accent, blur, perf }));
    loadTheme();
  }

  document.getElementById('themeAccent')?.addEventListener('input', saveTheme);
  document.getElementById('themeBlur')?.addEventListener('input', saveTheme);
  document.getElementById('themeAccent')?.addEventListener('input', saveTheme);
  document.getElementById('themeBlur')?.addEventListener('input', saveTheme);
  document.getElementById('themePerf')?.addEventListener('change', saveTheme);
  document.getElementById('resetThemeBtn')?.addEventListener('click', () => {
    document.getElementById('themeAccent').value = '#4fc3f7';
    document.getElementById('themeBlur').value = '10';
    document.getElementById('themePerf').checked = false;
    saveTheme();
  });

  // ── Modals & Add Game ─────────────────────────────────
  const addGameModal = document.getElementById('addGameModal');
  const gameNameInput = document.getElementById('gameNameInput');
  const gameExeInput = document.getElementById('gameExeInput');
  const gameImageInput = document.getElementById('gameImageInput');
  const imagePreview = document.getElementById('imagePreview');
  const modalTitle = document.getElementById('modalTitle');
  const confirmBtn = document.getElementById('confirmAddBtn');

  function openAddModal(platform) {
    isEditing = false; editingOldName = ''; currentImageData = '';
    editingPlatform = platform;
    gameNameInput.value = ''; gameExeInput.value = '';
    imagePreview.innerHTML = '<span>🖼️</span>';
    if (modalTitle) modalTitle.textContent = t('addGameTitle').replace('Epic ', '');
    if (confirmBtn) confirmBtn.textContent = t('addBtn');
    addGameModal.style.display = 'flex';
  }

  document.getElementById('addOtherGameBtn')?.addEventListener('click', () => openAddModal('other'));
  document.getElementById('cancelAddBtn')?.addEventListener('click', () => { addGameModal.style.display = 'none'; });

  document.getElementById('browseExeBtn')?.addEventListener('click', async () => {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Executables', extensions: ['exe', 'bat', 'sh', 'app', '*'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      gameExeInput.value = result.filePaths[0];
      // Pre-fill name from filename
      if (!gameNameInput.value) {
        const base = result.filePaths[0].split(/[\\/]/).pop().replace(/\.(exe|bat|sh|app)$/i, '');
        gameNameInput.value = base;
      }
    }
  });

  document.getElementById('uploadImageBtn')?.addEventListener('click', () => gameImageInput.click());

  gameImageInput?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      currentImageData = ev.target.result;
      imagePreview.innerHTML = `<img src="${ev.target.result}" alt="Preview" />`;
    };
    reader.readAsDataURL(file);
  });

  confirmBtn?.addEventListener('click', async () => {
    const name = gameNameInput.value.trim();
    const exePath = gameExeInput.value.trim();
    if (!name || !exePath) { alert(t('missingData')); return; }

    const gameData = { name, exePath, imageData: currentImageData };

    if (isEditing) {
      if (editingPlatform === 'epic') {
        await window.electronAPI.updateEpicGame(editingOldName, gameData);
        epicCacheValid = false;
      } else {
        await window.electronAPI.updateOtherGame(editingOldName, gameData);
        otherCacheValid = false;
      }
    } else {
      if (editingPlatform === 'epic') {
        await window.electronAPI.addEpicGame(gameData);
        epicCacheValid = false;
      } else {
        // If no image, try to extract from exe image asynchronously
        if (!currentImageData && gameImageInput.files.length === 0) {
          await window.electronAPI.addOtherGame({ ...gameData, imageData: '' });
        } else {
          await window.electronAPI.addOtherGame(gameData);
        }
        otherCacheValid = false;
      }
    }

    addGameModal.style.display = 'none';
    await refreshCurrentTab();
  });

  // ── Auto-Detect Epic ──────────────────────────────
  document.getElementById('autoDetectEpicBtn')?.addEventListener('click', async () => {
    const modal = document.getElementById('autoDetectModal');
    const subtitle = document.getElementById('autoDetectSubtitle');
    const listEl = document.getElementById('autoDetectList');
    const confBtn = document.getElementById('confirmDetectBtn');

    subtitle.textContent = t('cmdEpicScanStart');
    listEl.innerHTML = '<p style="color:#888;text-align:center;padding:20px">🔍 Scanning manifests...</p>';
    confBtn.style.display = 'none';
    modal.style.display = 'flex';

    const result = await window.electronAPI.autoDetectEpicGames();
    const games = result.games || [];

    if (games.length === 0) {
      subtitle.textContent = t('autoDetectNone');
      listEl.innerHTML = '';
    } else {
      subtitle.textContent = t('autoDetectFound', games.length);
      confBtn.style.display = '';
      listEl.innerHTML = '';
      games.forEach((g, idx) => {
        const row = document.createElement('label');
        row.className = 'detect-row';
        // Show image preview if we got an icon
        const imgHtml = g.imageData
          ? `<img class="detect-icon" src="${g.imageData}" alt="" />`
          : `<div class="detect-icon-placeholder" style="background:${nameToGradient(g.name)}"></div>`;
        row.innerHTML = `
          <input type="checkbox" class="detect-check" data-idx="${idx}" checked />
          ${imgHtml}
          <div class="detect-info">
            <span class="detect-name">${g.name}</span>
            <span class="detect-path">${g.exePath}</span>
          </div>`;
        listEl.appendChild(row);
      });
    }

    document.getElementById('cancelDetectBtn').onclick = () => { modal.style.display = 'none'; };
    confBtn.onclick = async () => {
      const selected = [...listEl.querySelectorAll('.detect-check:checked')]
        .map(cb => games[parseInt(cb.dataset.idx)]);
      for (const g of selected) {
        await window.electronAPI.addEpicGame({ name: g.name, exePath: g.exePath, imageData: g.imageData || '' });
      }
      modal.style.display = 'none';
      epicCacheValid = false;
      epicGames = await window.electronAPI.getEpicGames();
      epicCacheValid = true;
      renderEpicGames(epicGames);
    };
  });

  // ── EXE Finder ───────────────────────────────────
  document.getElementById('findExeBtn')?.addEventListener('click', async () => {
    const panel = document.getElementById('exeFinderPanel');
    if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
    panel.style.display = 'block';

    const listEl = document.getElementById('exeSuggestionsList');
    listEl.innerHTML = '<p style="color:#666;text-align:center;padding:12px">🔍 Scanning...</p>';

    if (exeSuggestions.length === 0) {
      exeSuggestions = await window.electronAPI.suggestExecutables();
    }
    renderExeSuggestions(exeSuggestions);
  });

  document.getElementById('closeExeFinder')?.addEventListener('click', () => {
    document.getElementById('exeFinderPanel').style.display = 'none';
  });

  document.getElementById('exeSearchFilter')?.addEventListener('input', debounce(e => {
    const q = e.target.value.toLowerCase().trim();
    renderExeSuggestions(q ? exeSuggestions.filter(s => s.name.toLowerCase().includes(q)) : exeSuggestions);
  }, 200));

  function renderExeSuggestions(list) {
    const listEl = document.getElementById('exeSuggestionsList');
    if (list.length === 0) {
      listEl.innerHTML = `<p style="color:#555;text-align:center;padding:12px">${t('exeSuggestionsNone')}</p>`;
      return;
    }
    listEl.innerHTML = '';
    list.slice(0, 60).forEach(item => {
      const row = document.createElement('div');
      row.className = 'exe-row';
      row.innerHTML = `
        <span class="exe-name">${item.name}</span>
        <span class="exe-path">${item.exePath}</span>
        <button class="exe-use-btn">${t('exeSuggestionsUse')}</button>`;
      row.querySelector('.exe-use-btn').onclick = () => {
        document.getElementById('exeFinderPanel').style.display = 'none';
        gameNameInput.value = item.name;
        gameExeInput.value = item.exePath;
        openAddModal('other');
        // Override name/exe after modal opens
        gameNameInput.value = item.name;
        gameExeInput.value = item.exePath;
      };
      listEl.appendChild(row);
    });
  }

  // ── Weekly Report ─────────────────────────────────
  document.getElementById('weeklyReportBtn')?.addEventListener('click', openWeeklyReport);
  document.getElementById('closeWeeklyBtn')?.addEventListener('click', () => {
    document.getElementById('weeklyReportModal').style.display = 'none';
  });
  window.__openWeeklyReport = openWeeklyReport;

  async function openWeeklyReport() {
    document.getElementById('weeklyReportModal').style.display = 'flex';
    renderWeeklyReport(await window.electronAPI.getWeeklyReport());
  }

  function renderWeeklyReport(data) {
    const totalEl = document.getElementById('weeklyTotalTime');
    totalEl.textContent = fmtTime(data.totalMinutes || 0);

    // Day bars
    const barsEl = document.getElementById('weeklyDayBars');
    const maxDay = Math.max(...(data.days || []).map(d => d.minutes), 1);
    barsEl.innerHTML = '';
    (data.days || []).forEach(day => {
      const pct = Math.round((day.minutes / maxDay) * 100);
      const label = new Date(day.date + 'T12:00:00').toLocaleDateString(
        getLanguage() === 'es' ? 'es-ES' : 'en-US', { weekday: 'short' });
      const bar = document.createElement('div');
      bar.className = 'week-bar';
      bar.innerHTML = `
        <div class="week-bar-track"><div class="week-bar-fill" style="height:${pct}%" title="${fmtTime(day.minutes)}"></div></div>
        <span class="week-bar-label">${label}</span>
        <span class="week-bar-time">${day.minutes > 0 ? fmtTime(day.minutes) : ''}</span>`;
      barsEl.appendChild(bar);
    });

    // Game list
    const listEl = document.getElementById('weeklyGameList');
    listEl.innerHTML = '';
    if (!data.games || data.games.length === 0) {
      listEl.innerHTML = `<p style="color:#555;text-align:center">${t('weeklyNoData')}</p>`;
      return;
    }
    const maxG = Math.max(...data.games.map(g => g.minutes), 1);
    data.games.forEach(game => {
      const pct = Math.round((game.minutes / maxG) * 100);
      const row = document.createElement('div');
      row.className = 'weekly-game-row';
      row.innerHTML = `
        <span class="weekly-game-name">${game.name}</span>
        <div class="weekly-bar-wrap"><div class="weekly-bar-fill" style="width:${pct}%"></div></div>
        <span class="weekly-game-time">${fmtTime(game.minutes)}</span>`;
      listEl.appendChild(row);
    });
  }

  // ── Settings ──────────────────────────────────────
  document.getElementById('settingsBtn')?.addEventListener('click', async () => {
    const modal = document.getElementById('settingsModal');
    const toggle = document.getElementById('startupToggle');
    toggle.checked = await window.electronAPI.getAutoLaunch();
    modal.style.display = 'flex';
  });
  document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
    document.getElementById('settingsModal').style.display = 'none';
  });
  document.getElementById('startupToggle')?.addEventListener('change', e => {
    window.electronAPI.setAutoLaunch(e.target.checked);
  });

  // Close modals on outside click
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
  });

  // ── Window controls ───────────────────────────────
  document.getElementById('minimizeBtn')?.addEventListener('click', () => window.electronAPI.minimizeWindow());
  document.getElementById('maximizeBtn')?.addEventListener('click', () => window.electronAPI.toggleMaximizeWindow());
  document.getElementById('closeBtn')?.addEventListener('click', () => window.electronAPI.closeWindow());

  // ── IPC events ────────────────────────────────────
  window.electronAPI.onUpdateLastGame(name => {
    const el = document.getElementById('last-game-name');
    if (el && name) { el.textContent = name; localStorage.setItem('lastPlayedGame', name); }
  });

  window.electronAPI.onRefreshGameList(async () => {
    steamCacheValid = epicCacheValid = otherCacheValid = false;
    await refreshCurrentTab();
  });

  // ── Language change ───────────────────────────────
  document.addEventListener('lang-changed', async () => {
    await renderHome();
    await refreshCurrentTab();
  });

  // ── Retro Games Logic ──────────────────────────────
  document.getElementById('addRetroGameBtn')?.addEventListener('click', () => {
    document.getElementById('addRetroModal').style.display = 'flex';
  });

  document.getElementById('cancelRetroAddBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('addRetroModal');
    modal.style.display = 'none';
    document.getElementById('retroNameInput').value = '';
    document.getElementById('retroEmuInput').value = '';
    document.getElementById('retroRomInput').value = '';
    document.getElementById('retroImagePreview').innerHTML = '<span>📸</span>';
    retroCoverData = null;
  });

  document.getElementById('confirmRetroAddBtn')?.addEventListener('click', async () => {
    const nameInput = document.getElementById('retroNameInput');
    const emuInput = document.getElementById('retroEmuInput');
    const romInput = document.getElementById('retroRomInput');
    const modal = document.getElementById('addRetroModal');

    if (!nameInput.value || !emuInput.value) {
      alert("Please provide at least a Name and an Emulator path.");
      if (!nameInput.value) nameInput.style.borderColor = "red";
      if (!emuInput.value) emuInput.style.borderColor = "red";
      return;
    }

    const targetFormat = `${emuInput.value}|||${romInput.value}`;
    const game = {
      id: Date.now().toString(),
      name: nameInput.value.trim(),

      exePath: targetFormat,
      imageData: retroCoverData
    };

    await window.electronAPI.addRetroGame(game);
    modal.style.display = 'none';
    nameInput.value = ''; emuInput.value = ''; romInput.value = '';
    nameInput.style.borderColor = ""; emuInput.style.borderColor = "";
    document.getElementById('retroImagePreview').innerHTML = '<span>📸</span>';
    retroCoverData = null;
    await _renderRetro();
  });

  document.getElementById('browseRetroEmuBtn')?.addEventListener('click', async () => {
    const res = await window.electronAPI.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Executables', extensions: ['exe', 'app'] }]
    });
    if (!res.canceled && res.filePaths.length > 0) {
      document.getElementById('retroEmuInput').value = res.filePaths[0];
      document.getElementById('retroEmuInput').style.borderColor = "";
    }
  });

  document.getElementById('browseRetroRomBtn')?.addEventListener('click', async () => {
    const res = await window.electronAPI.showOpenDialog({ properties: ['openFile'] });
    if (!res.canceled && res.filePaths.length > 0) document.getElementById('retroRomInput').value = res.filePaths[0];
  });

  document.getElementById('retroImagePreview')?.addEventListener('click', async () => {
    const result = await window.electronAPI.selectCustomCover();
    if (result.success && result.data) {
      retroCoverData = result.data;
      document.getElementById('retroImagePreview').innerHTML = `<img src="${result.data}" />`;
    }
  });
});



// ── Shared UI Functions ─────────────────────────
async function refreshCurrentTab() {
  const active = document.querySelector('.tab-button.active')?.dataset.platform || 'home';
  if (active === 'steam') {
    if (!steamCacheValid) { steamGames = await window.electronAPI.getSteamGames(); steamCacheValid = true; }
    const q = document.getElementById('searchInput')?.value.toLowerCase();
    renderSteamGames(q ? steamGames.filter(g => g.name.toLowerCase().includes(q)) : steamGames);
  } else if (active === 'epic') {
    if (!epicCacheValid) { epicGames = await window.electronAPI.getEpicGames(); epicCacheValid = true; }
    const q = document.getElementById('epicSearchInput')?.value.toLowerCase();
    renderEpicGames(q ? epicGames.filter(g => g.name.toLowerCase().includes(q)) : epicGames);
  } else if (active === 'other') {
    if (!otherCacheValid) { otherGames = await window.electronAPI.getOtherGames(); otherCacheValid = true; }
    renderOtherGames(otherGames);
  } else if (active === 'retro') {
    await _renderRetro();
  } else if (active === 'profile') {
    await renderProfile();
  } else {
    await renderHome();
  }
}

async function _renderRetro() {
  const games = await window.electronAPI.getRetroGames();
  const list = document.getElementById('retro-games-list');
  list.innerHTML = '';
  if (!games.length) { list.innerHTML = `<p style="text-align:center;color:#777;">No Retro Games added yet.</p>`; return; }
  const frag = document.createDocumentFragment();
  games.forEach(g => frag.appendChild(createGameCard(g, 'retro')));
  list.appendChild(frag);
}

function renderSteamGames(games) {
  const list = document.getElementById('games-list');
  list.innerHTML = '';
  if (!games.length) { list.innerHTML = `<p style="text-align:center;color:#777;">${t('noGamesFound')}</p>`; return; }
  const frag = document.createDocumentFragment();
  games.forEach(g => frag.appendChild(createGameCard(g, 'steam')));
  list.appendChild(frag);
}

function renderEpicGames(games) {
  const list = document.getElementById('epic-games-list');
  list.innerHTML = '';
  if (!games.length) { list.innerHTML = `<p style="text-align:center;color:#777;">${t('noEpicGames')}</p>`; return; }
  const frag = document.createDocumentFragment();
  games.forEach(g => frag.appendChild(createGameCard(g, 'epic')));
  list.appendChild(frag);
}

function renderOtherGames(games) {
  const list = document.getElementById('other-games-list');
  list.innerHTML = '';
  if (!games.length) { list.innerHTML = `<p style="text-align:center;color:#777;">${t('noOtherGames')}</p>`; return; }
  const frag = document.createDocumentFragment();
  games.forEach(g => frag.appendChild(createGameCard(g, 'other')));
  list.appendChild(frag);
}

async function renderHome() {
  // Update Welcome text
  const welcomeEl = document.getElementById('welcomeText');
  const totalTimeEl = document.getElementById('totalTimeIntro');
  const userName = localStorage.getItem('ludix_user') || 'Player';
  const hora = new Date().getHours();
  const key = hora < 6 ? 'greetingEvening' : hora < 13 ? 'greetingMorning' : hora < 20 ? 'greetingAfternoon' : 'greetingEvening';

  if (welcomeEl) welcomeEl.innerHTML = `${t(key)}, <span id="user-display-name" style="color:var(--accent);">${userName}</span>!`;

  let news = [];
  let epic = [], steam = [], other = [];
  try {
    const results = await Promise.all([
      window.electronAPI.getEpicGames(),
      window.electronAPI.getSteamGames(),
      window.electronAPI.getOtherGames(),
      window.electronAPI.getGamingNews()
    ]);
    epic = results[0]; steam = results[1]; other = results[2]; news = results[3];
  } catch (err) {
    console.error("Home Data Error:", err);
    epic = epic || []; steam = steam || []; other = other || []; news = [];
  }

  const allGames = [
    ...epic.map(g => ({ ...g, platform: 'epic' })),
    ...steam.map(g => ({ ...g, platform: 'steam' })),
    ...other.map(g => ({ ...g, platform: 'other' }))
  ];

  const totalMins = allGames.reduce((a, g) => a + (g.playTime || 0), 0);
  if (totalTimeEl) totalTimeEl.textContent = `You have spent ${Math.floor(totalMins / 60)} hours enjoying your games on Ludix.`;

  // Render RSS News
  const newsContainer = document.getElementById('gaming-news-list');
  if (newsContainer) {
    if (news && news.length > 0) {
      newsContainer.innerHTML = '';
      news.forEach(item => {
        const d = new Date(item.date).toLocaleDateString();
        newsContainer.innerHTML += `
          <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; cursor:pointer;" onclick="window.electronAPI.openExternal('${item.link}')" class="news-item">
            <div style="font-size:0.75rem; color:#888; margin-bottom:4px;">${d}</div>
            <div style="color:#e0e0e0; font-weight:600; line-height:1.3;">${item.title}</div>
          </div>
        `;
      });
    } else {
      newsContainer.innerHTML = '<p style="color:#777; text-align:center;">Feed offline.</p>';
    }
  }

  const container = document.getElementById('top-games-list');
  if (!container) return;
  container.innerHTML = '';

  const topGames = allGames.filter(g => (g.playTime || 0) > 0).sort((a, b) => (b.playTime || 0) - (a.playTime || 0)).slice(0, 4);

  if (!topGames.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:#555;width:100%;grid-column:1/-1;">
      <p>${t('noStats')}</p><p style="font-size:.8rem;">${t('noStatsHint')}</p></div>`;
    return;
  }
  const frag = document.createDocumentFragment();
  topGames.forEach(g => { const c = createGameCard(g, g.platform); c.classList.add('top-game-featured'); frag.appendChild(c); });
  container.appendChild(frag);
}

async function renderProfile() {
  const [epic, steam, other] = await Promise.all([
    window.electronAPI.getEpicGames(),
    window.electronAPI.getSteamGames(),
    window.electronAPI.getOtherGames()
  ]);

  const allGames = [
    ...epic.map(g => ({ ...g, platform: 'epic' })),
    ...steam.map(g => ({ ...g, platform: 'steam' })),
    ...other.map(g => ({ ...g, platform: 'other' }))
  ].filter(g => (g.playTime || 0) > 0).sort((a, b) => (b.playTime || 0) - (a.playTime || 0));

  const totalMins = allGames.reduce((a, g) => a + g.playTime, 0);

  document.getElementById('profile-total-hours').textContent = fmtTime(totalMins);
  document.getElementById('profile-total-games').textContent = allGames.length;

  const listEl = document.getElementById('profile-most-played-list');
  listEl.innerHTML = '';

  if (allGames.length === 0) {
    listEl.innerHTML = '<p style="color:#777;padding:20px;text-align:center;">No playtime recorded yet!</p>';
    return;
  }

  const maxTime = allGames[0].playTime;

  allGames.slice(0, 10).forEach((g, idx) => {
    const row = document.createElement('div');
    const pct = Math.round((g.playTime / maxTime) * 100);
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-weight:600;"><span style="color:#888;margin-right:12px;">#${idx + 1}</span>${g.name}</span>
        <span style="color:var(--accent);font-weight:600;">${fmtTime(g.playTime)}</span>
      </div>
      <div style="width:100%;height:8px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:linear-gradient(90deg, #111, var(--accent));border-radius:4px;"></div>
      </div>
    `;
    listEl.appendChild(row);
  });
}

// ── Game Card ─────────────────────────────────────────
function createGameCard(game, platform) {
  const card = document.createElement('div');
  card.className = 'game-card';

  // Image container
  const imgContainer = document.createElement('div');
  imgContainer.className = 'game-image-container';

  // Platform badge
  const badge = document.createElement('div');
  badge.className = 'platform-icon';
  const badgeImg = document.createElement('img');
  if (platform === 'steam') {
    badgeImg.src = 'https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg';
  } else if (platform === 'epic') {
    badgeImg.src = 'https://upload.wikimedia.org/wikipedia/commons/3/31/Epic_Games_logo.svg';
  } else {
    badgeImg.src = ''; badgeImg.style.display = 'none';
    badge.textContent = '🎮'; badge.style.fontSize = '12px';
  }
  badge.appendChild(badgeImg);
  imgContainer.appendChild(badge);

  // Game image
  const img = document.createElement('img');
  img.className = 'game-image';

  if (platform === 'steam') {
    // Lazy load from Steam CDN
    img.dataset.src = `https://cdn.akamai.steamstatic.com/steam/apps/${game.id}/header.jpg`;
    img.style.background = nameToGradient(game.name);
    imageObserver.observe(img);
  } else if (game.imageData && game.imageData.length > 0) {
    // Has saved image (base64 from exe icon or user upload)
    img.src = game.imageData;
    img.onload = () => img.classList.add('loaded');
    img.onerror = () => { img.removeAttribute('src'); img.classList.add('loaded'); };
  } else {
    // Try Twitch BoxArt CDN first, fallback to gradient
    img.dataset.src = `https://static-cdn.jtvnw.net/ttv-boxart/${encodeURIComponent(game.name)}-285x380.jpg`;
    img.style.background = nameToGradient(game.name);
    imageObserver.observe(img);
    img.onerror = () => { img.removeAttribute('src'); };
  }

  imgContainer.appendChild(img);
  card.appendChild(imgContainer);

  // Title
  const title = document.createElement('h3');
  title.className = 'game-title';
  title.textContent = game.name;
  card.appendChild(title);

  // Playtime
  const timeDiv = document.createElement('div');
  timeDiv.className = 'game-playtime';
  timeDiv.innerHTML = `<span>⏱ ${fmtTime(game.playTime || 0)}</span>`;
  card.appendChild(timeDiv);

  // Delete + Edit buttons (non-Steam only)
  if (platform !== 'steam') {
    const btnWrap = document.createElement('div');
    btnWrap.className = 'card-action-btns';

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-game-btn';
    delBtn.innerHTML = '×';
    delBtn.onclick = async e => {
      e.stopPropagation();
      if (confirm(t('deleteConfirm', game.name))) {
        if (platform === 'epic') { await window.electronAPI.deleteEpicGame(game.name); epicCacheValid = false; }
        else if (platform === 'retro') { await window.electronAPI.deleteRetroGame(game.name); }
        else { await window.electronAPI.deleteOtherGame(game.name); otherCacheValid = false; }
        location.reload();
      }
    };

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = '⚙️';
    editBtn.onclick = e => {
      e.stopPropagation();
      isEditing = true; editingOldName = game.name; editingPlatform = platform;
      currentImageData = game.imageData || '';
      document.getElementById('gameNameInput').value = game.name;
      document.getElementById('gameExeInput').value = game.exePath;
      const prev = document.getElementById('imagePreview');
      prev.innerHTML = game.imageData ? `<img src="${game.imageData}" />` : '<span>🖼️</span>';
      const mt = document.getElementById('modalTitle'); if (mt) mt.textContent = t('editGameTitle');
      const cb = document.getElementById('confirmAddBtn'); if (cb) cb.textContent = t('saveBtn');
      document.getElementById('addGameModal').style.display = 'flex';
    };

    btnWrap.appendChild(delBtn);
    btnWrap.appendChild(editBtn);
    card.appendChild(btnWrap);
  }

  // Click to launch
  card.addEventListener('click', () => {
    const orig = title.textContent;
    title.textContent = t('counting');
    title.style.color = 'var(--accent)';
    card.style.pointerEvents = 'none';
    setTimeout(() => { title.textContent = orig; title.style.color = ''; card.style.pointerEvents = 'auto'; }, 5000);

    const path = platform === 'steam' ? `steam://rungameid/${game.id}` : game.exePath;
    window.electronAPI.launchGame(path, game.name);
  });

  // Dynamic Background on hover
  card.addEventListener('mouseenter', () => {
    const bgUrl = img.src || img.dataset.src;
    const savedBg = localStorage.getItem('ludix_bg');
    const isVideo = savedBg && (savedBg.endsWith('.mp4') || savedBg.endsWith('.webm'));
    if (bgUrl && !isVideo) {
      document.body.style.backgroundImage = `linear-gradient(rgba(15, 15, 18, 0.85), rgba(15, 15, 18, 0.95)), url('${bgUrl}')`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
    }
  });

  card.addEventListener('mouseleave', () => {
    const savedBg = localStorage.getItem('ludix_bg');
    if (!savedBg || savedBg === 'null') {
      document.body.style.backgroundImage = 'none';
    } else if (!savedBg.endsWith('.mp4') && !savedBg.endsWith('.webm')) {
      document.body.style.backgroundImage = `url('${savedBg}')`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
    }
  });

  // Right-click to change cover
  card.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    const result = await window.electronAPI.selectCustomCover();
    if (result && result.success) {
      if (platform === 'epic') {
        await window.electronAPI.updateEpicGame(game.name, { ...game, imageData: result.data });
        epicCacheValid = false;
      } else if (platform === 'other') {
        await window.electronAPI.updateOtherGame(game.name, { ...game, imageData: result.data });
        otherCacheValid = false;
      } else if (platform === 'retro') {
        await window.electronAPI.updateRetroGame(game.name, { ...game, imageData: result.data });
      } else if (platform === 'steam') {
        await window.electronAPI.saveSteamCustomCover(game.id, result.data);
        steamCacheValid = false;
      }
      refreshCurrentTab();
    }
  });

  return card;
}

// ── Status Bar ─────────────────────────────────────────
function initStatusBar() {
  const clockEl = document.getElementById('footer-clock');
  if (clockEl) setInterval(() => {
    clockEl.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }, 1000);

  const ramEl = document.getElementById('ram-usage');
  if (ramEl) {
    const updateRam = async () => {
      try {
        const r = await window.electronAPI.getRamUsage();
        ramEl.textContent = `RAM: ${r.usedGB}/${r.totalGB} GB`;
      } catch { }
    };
    updateRam();
    setInterval(updateRam, 10000);
  }
}

function loadLastGame() {
  const name = localStorage.getItem('lastPlayedGame');
  const el = document.getElementById('last-game-name');
  if (el && name) el.textContent = name;
}

async function updateBattery() {
  const icon = document.getElementById('battery-icon');
  const lvl = document.getElementById('battery-level');
  if (!('getBattery' in navigator)) { if (icon) icon.style.display = 'none'; if (lvl) lvl.textContent = 'AC'; return; }
  try {
    const bat = await navigator.getBattery();
    const refresh = () => {
      const pct = Math.round(bat.level * 100);
      if (lvl) lvl.textContent = `${pct}%`;
      if (icon) { icon.textContent = bat.charging ? '⚡' : '🔋'; icon.style.color = bat.charging ? '#4caf50' : (pct <= 20 ? '#ff5252' : '#888'); }
    };
    refresh();
    bat.addEventListener('levelchange', refresh);
    bat.addEventListener('chargingchange', refresh);
  } catch { }
}

function initLanguageSwitcher() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
    btn.classList.toggle('active', btn.dataset.lang === getLanguage());
  });
}