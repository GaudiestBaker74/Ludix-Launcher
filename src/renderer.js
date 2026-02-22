function startClock() {
  const clockElement = document.getElementById('digital-clock');
  if (!clockElement) return;

  setInterval(() => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');

    const opacity = (now.getSeconds() % 2 === 0) ? "1" : "0.2";
    const separator = `<span style="opacity: ${opacity}">:</span>`;

    clockElement.innerHTML = `${h}${separator}${m}${separator}${s}`;
  }, 1000);
}

let isEditing = false;
let editingOldName = ""; // To know which game to overwrite

document.addEventListener('DOMContentLoaded', async () => {
  let allSteamGames = [];
  let epicGames = [];
  startClock();
  loadLastGame();
  initStatusBar();
  updateBattery();

  // 1. LOAD MAIN PANEL AT START
  await renderHome();

  // Load data in background
  try {
    epicGames = await window.electronAPI.getEpicGames();
    allSteamGames = await window.electronAPI.getSteamGames();
  } catch (err) { console.error(err); }

  // === UPDATED TAB LOGIC ===
  const tabButtons = document.querySelectorAll('.tab-button');
  const views = document.querySelectorAll('.platform-view');
  const underline = document.querySelector('.tab-underline');

  function updateUnderline(activeButton) {
    const tabsContainer = document.querySelector('.tabs');
    const buttonRect = activeButton.getBoundingClientRect();
    const containerRect = tabsContainer.getBoundingClientRect();
    underline.style.width = `${activeButton.offsetWidth}px`;
    underline.style.transform = `translateX(${buttonRect.left - containerRect.left}px)`;
  }

  tabButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const platform = button.dataset.platform;

      // Change active classes
      tabButtons.forEach(btn => btn.classList.remove('active'));
      views.forEach(view => view.classList.remove('active'));
      button.classList.add('active');
      document.getElementById(`${platform}-view`).classList.add('active');
      updateUnderline(button);

      // LOAD CONTENT ACCORDING TO TAB
      if (platform === 'home') {
        await renderHome();
        const games = await window.electronAPI.getEpicGames();
        // Count how many have play time (maximum 4 according to your logic)
        const topCount = games.filter(g => (g.playTime || 0) > 0).slice(0, 3).length;
        updateStatus(topCount, "Panel Principal");
      } else if (platform === 'steam') {
        const steamGames = await window.electronAPI.getSteamGames();
        renderSteamGames(steamGames);
        updateStatus(steamGames.length, "Steam");
      } else if (platform === 'epic') {
        const epicGames = await window.electronAPI.getEpicGames();
        renderEpicGames(epicGames);
        updateStatus(epicGames.length, "Epic Games");
      }
    });
  });

  // Initialize underline
  const activeTab = document.querySelector('.tab-button.active');
  if (activeTab) updateUnderline(activeTab);

  // Steam Search
  document.getElementById('searchInput')?.addEventListener('input', () => {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const filtered = allSteamGames.filter(game =>
      game.name.toLowerCase().includes(query)
    );
    renderSteamGames(filtered);
  });

  // === EPIC GAME ADD MODAL ===
  const addGameModal = document.getElementById('addGameModal');
  const gameNameInput = document.getElementById('gameNameInput');
  const gameExeInput = document.getElementById('gameExeInput');
  const gameImageInput = document.getElementById('gameImageInput');
  const imagePreview = document.getElementById('imagePreview');
  const browseExeBtn = document.getElementById('browseExeBtn');
  const uploadImageBtn = document.getElementById('uploadImageBtn');
  const cancelAddBtn = document.getElementById('cancelAddBtn');
  const confirmAddBtn = document.getElementById('confirmAddBtn');
  const modalTitle = document.getElementById('modalTitle');

  // Open modal
  document.getElementById('addEpicGameBtn')?.addEventListener('click', () => {
    gameNameInput.value = '';
    gameExeInput.value = '';
    imagePreview.innerHTML = '<span>🖼️</span>';
    addGameModal.style.display = 'flex';
  });

  // Close modal
  cancelAddBtn?.addEventListener('click', () => {
    addGameModal.style.display = 'none';
  });

  // Select .exe
  browseExeBtn?.addEventListener('click', async () => {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Ejecutables', extensions: ['exe', 'bat'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      gameExeInput.value = result.filePaths[0];
    }
  });

  // Upload image
  uploadImageBtn?.addEventListener('click', () => {
    gameImageInput.click();
  });

  gameImageInput?.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview" />`;
      };
      reader.readAsDataURL(file);
    }
  });

  confirmAddBtn?.addEventListener('click', async () => {
    const name = gameNameInput.value.trim();
    const exePath = gameExeInput.value.trim();

    if (!name || !exePath) {
      alert('Faltan datos obligatorios.');
      return;
    }

    const file = gameImageInput.files[0];

    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = e.target.result; // Aquí está tu imagen 
        await window.electronAPI.addEpicGame({ name, exePath, imageData });
        refreshEpicList();
      };
      reader.readAsDataURL(file);
    } else {
      await window.electronAPI.addEpicGame({ name, exePath, imageData: null });
      refreshEpicList();
    }
  });

  async function refreshEpicList() {
    epicGames = await window.electronAPI.getEpicGames();
    renderEpicGames(epicGames);
    addGameModal.style.display = 'none';
  }

  // Render Steam Games
  function renderSteamGames(games) {
    const list = document.getElementById('games-list');
    list.innerHTML = '';
    if (games.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:#777;">No se encontraron juegos.</p>';
      return;
    }
    games.forEach(game => {
      const card = createGameCard(game, 'steam');
      list.appendChild(card);
    });
  }

  function openEditModal(game) { // Its Bugged, so don't use it :(
    isEditing = true;
    editingOldName = game.name;

    // Fill inputs with current data
    document.getElementById('gameNameInput').value = game.name;
    document.getElementById('gameExeInput').value = game.exePath;
    document.getElementById('imagePreview').src = game.imageData || "";
    currentImageData = game.imageData || "";

    document.getElementById('addGameModal').style.display = 'flex';
    document.getElementById('modalTitle').textContent = "Editar Juego";
    document.getElementById('confirmAddBtn').textContent = "Guardar Cambios";
  }

  function renderEpicGames(games) {
    const list = document.getElementById('epic-games-list');
    list.innerHTML = '';

    const epicView = document.getElementById('epic-view');
    const existingSearch = epicView.querySelector('.search-container');

    // 1. THE SEARCHER
    if (!existingSearch) {
      const searchContainer = document.createElement('div');
      searchContainer.className = 'search-container';
      searchContainer.innerHTML = `
            <div class="search-icon">🔍</div>
            <input type="text" id="epicSearchInput" placeholder="Search in Epic..." />
        `;
      epicView.insertBefore(searchContainer, list);

      document.getElementById('epicSearchInput').addEventListener('input', () => {
        const query = document.getElementById('epicSearchInput').value.toLowerCase().trim();
        window.electronAPI.getEpicGames().then(allGames => {
          const filtered = allGames.filter(game => game.name.toLowerCase().includes(query));
          renderEpicGames(filtered); // Render filtered
        });
      });
    }

    // 2. Message if it's empty
    if (games.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:#777;width:100%;">You don\'t have any games added yet.</p>';
      return;
    }

    // 3. CARD GENERATION (Here's where the edit button goes)
    games.forEach(game => {
      const card = createGameCard(game, 'epic');

      // Edit Button
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-btn';
      editBtn.innerHTML = '⚙️';
      editBtn.onclick = (e) => {
        e.stopPropagation();
        isEditing = true;
        editingOldName = game.name;
        gameNameInput.value = game.name;
        gameExeInput.value = game.exePath;
        imagePreview.src = game.imageData || '';
        currentImageData = game.imageData || '';
        if (modalTitle) modalTitle.textContent = "Editar Juego";
        if (confirmAddBtn) confirmAddBtn.textContent = "Guardar Cambios";
        addGameModal.style.display = 'flex';
      };

      card.appendChild(editBtn);
      list.appendChild(card);
    });
  }

  function createGameCard(game, platform) {
    const card = document.createElement('div');
    card.className = 'game-card';

    // 1. Image Container
    const imgContainer = document.createElement('div');
    imgContainer.className = 'game-image-container';

    // --- NEW: PLATFORM ICON ---
    const iconContainer = document.createElement('div');
    iconContainer.className = 'platform-icon';
    const platformLogo = document.createElement('img');

    // Here you can use icon URLs or local paths if you have the files
    if (platform === 'steam') {
      platformLogo.src = 'https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg';
    } else {
      // Epic logo or a generic controller for manuals
      platformLogo.src = 'https://upload.wikimedia.org/wikipedia/commons/3/31/Epic_Games_logo.svg';
    }

    iconContainer.appendChild(platformLogo);
    imgContainer.appendChild(iconContainer);

    const img = document.createElement('img');
    img.className = 'game-image loaded';

    // If it's Steam we use its CDN, if not, the saved image or placeholder
    img.src = platform === 'steam'
      ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.id}/header.jpg`
      : (game.imageData || 'assets/placeholder.png');

    imgContainer.appendChild(img);
    card.appendChild(imgContainer);

    // 2. Game Title
    const title = document.createElement('h3');
    title.className = 'game-title';
    title.textContent = game.name;
    card.appendChild(title);

    // 3. PLAYTIME COUNTER
    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'game-playtime';
    const totalMinutes = game.playTime || 0;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    timeDisplay.innerHTML = `<span>⏱ ${h}h ${m}m</span>`;
    card.appendChild(timeDisplay);

    // 4. Delete/Edit buttons (For Epic and "Others")
    if (platform !== 'steam') {
      const deleteBtn = document.createElement('button');
      deleteBtn.innerHTML = '×';
      deleteBtn.className = 'delete-game-btn';
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm(`Delete ${game.name}?`)) {
          await window.electronAPI.deleteEpicGame(game.name);
          // Refresh current view
          location.reload();
        }
      };

      const editBtn = document.createElement('button');
      editBtn.innerHTML = '⚙️';
      editBtn.className = 'edit-btn';
      editBtn.onclick = (e) => {
        e.stopPropagation();
        isEditing = true;
        editingOldName = game.name;
        document.getElementById('gameNameInput').value = game.name;
        document.getElementById('gameExeInput').value = game.exePath;
        document.getElementById('imagePreview').src = game.imageData || '';
        currentImageData = game.imageData || '';
        document.getElementById('modalTitle').textContent = "Edit Game";
        document.getElementById('confirmAddBtn').textContent = "Save Changes";
        document.getElementById('addGameModal').style.display = 'flex';
      };

      card.appendChild(deleteBtn);
      card.appendChild(editBtn);
    }

    // 5. UNIFIED CLICK LOGIC (Steam and Epic count hours now)
    card.addEventListener('click', () => {
      const originalTitle = title.textContent;

      // Visual feedback
      title.textContent = "⏱ Counting time...";
      title.style.color = "var(--accent)";
      card.style.pointerEvents = "none";

      setTimeout(() => {
        title.textContent = originalTitle;
        title.style.color = "";
        card.style.pointerEvents = "auto";
      }, 5000);

      // UNIVERSAL LAUNCH
      // If it's Steam, we try to use the executable path if you have it, 
      // or the steam command if main.js is ready to handle it.
      if (platform === 'steam') {
        // For Steam, the ideal is that exePath is the path to the game's .exe
        // If you don't have it, we'll use the ID to launch it via command
        const steamPath = `steam://rungameid/${game.id}`;
        window.electronAPI.launchGame(steamPath, game.name);
      } else {
        // Epic and manuals
        window.electronAPI.launchGame(game.exePath, game.name);
      }
    });

    return card;
  }

  async function renderHome() {
    const homeView = document.getElementById('home-view');
    const header = homeView.querySelector('h2');

    // 1. Get saved name or use "Player"
    const userName = localStorage.getItem('ludix_user') || "Player";

    // Dynamic greeting according to the hour
    const hora = new Date().getHours();
    let saludoBase = "¡A jugar!";
    if (hora >= 6 && hora < 13) saludoBase = "Good morning";
    else if (hora >= 13 && hora < 20) saludoBase = "Good afternoon";
    else saludoBase = "Good evening";

    // Insertamos el saludo con un span con ID para el nombre
    header.innerHTML = `${saludoBase}, <span id="user-display-name">${userName}</span>!`;

    // 2. Get games from BOTH platforms
    // getSteamGames already comes with playTime included from the new playtime.json
    const epicGames = await window.electronAPI.getEpicGames();
    const steamGames = await window.electronAPI.getSteamGames();

    // Combine the lists marking their original platform
    const allGames = [
      ...epicGames.map(g => ({ ...g, platform: 'epic' })),
      ...steamGames.map(g => ({ ...g, platform: 'steam' }))
    ];

    // 3. Calculate global statistics (Sum of minutes from all games)
    const totalMinutes = allGames.reduce((acc, g) => acc + (g.playTime || 0), 0);
    const totalH = Math.floor(totalMinutes / 60);

    // Statistics subtitle management
    let statsSub = homeView.querySelector('.home-stats-sub');
    if (!statsSub) {
      statsSub = document.createElement('p');
      statsSub.className = 'home-stats-sub';
      statsSub.style.fontSize = '0.9rem';
      statsSub.style.color = '#888';
      statsSub.style.marginTop = '5px';
      statsSub.style.marginBottom = '20px';
      header.parentNode.insertBefore(statsSub, header.nextSibling);
    }
    statsSub.textContent = `You have spent ${totalH} hours enjoying your games on Ludix.`;

    // 4. Prepare the container
    const homeContainer = document.getElementById('top-games-list');
    if (!homeContainer) return;
    homeContainer.innerHTML = '';

    // 5. Filter and sort the Top 4 global
    const topGames = allGames
      .filter(g => (g.playTime || 0) > 0)
      .sort((a, b) => (b.playTime || 0) - (a.playTime || 0))
      .slice(0, 3);

    // If there is no registered time yet
    if (topGames.length === 0) {
      homeContainer.innerHTML = `
            <div style="text-align:center; padding:40px; color:#555; width:100%; grid-column: 1 / -1;">
                <p>There are no game statistics yet.</p>
                <p style="font-size: 0.8rem;">Start any game to start seeing your activity here!</p>
            </div>`;
      return;
    }

    // 6. Render the cards
    const fragment = document.createDocumentFragment();
    topGames.forEach(game => {
      // Use game.platform so createGameCard decides whether to use Steam URL or local image
      const card = createGameCard(game, game.platform);
      card.classList.add('top-game-featured');
      fragment.appendChild(card);
    });

    homeContainer.appendChild(fragment);
  }

  function initStatusBar() {
    // --- 24 HOUR CLOCK ---
    const clockEl = document.getElementById('footer-clock');
    if (clockEl) {
      setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        clockEl.textContent = timeStr;
      }, 1000);
    }

    // --- LOAD LAST GAME ---
    // We look in storage if there is anything saved from previous sessions
    const lastGameName = localStorage.getItem('lastPlayedGame');
    const lastGameDisplay = document.getElementById('last-game-name');

    if (lastGameDisplay && lastGameName) {
      lastGameDisplay.textContent = lastGameName;
    }

    // --- RAM MONITOR ---
    const ramEl = document.getElementById('ram-usage');
    if (ramEl) {
      setInterval(async () => {
        try {
          const ram = await window.electronAPI.getRamUsage();
          ramEl.textContent = `RAM: ${ram} MB`;
        } catch (e) {
          console.error("Error al obtener RAM");
        }
      }, 5000);
    }
  }

  // 1. For the RAM to update itself every 5 seconds
  async function updateRAM() {
    const ramElement = document.getElementById('ram-usage');
    if (!ramElement) return;

    setInterval(async () => {
      const ram = await window.electronAPI.getRamUsage();
      ramElement.textContent = `RAM: ${ram} MB`;
    }, 5000);
  }

  // 2. To load the name that was saved last time
  function loadLastGame() {
    const lastGameName = localStorage.getItem('lastPlayedGame');
    const display = document.getElementById('last-game-name');
    if (display && lastGameName) {
      display.textContent = lastGameName;
    }
  }

  async function updateBattery() {
    const batteryIcon = document.getElementById('battery-icon');
    const batteryLevel = document.getElementById('battery-level');

    if (!('getBattery' in navigator)) {
      if (batteryIcon) batteryIcon.style.display = 'none';
      if (batteryLevel) batteryLevel.textContent = "AC";
      return;
    }

    try {
      const battery = await navigator.getBattery();

      const refreshBatteryUI = () => {
        const level = Math.round(battery.level * 100);
        if (batteryLevel) batteryLevel.textContent = `${level}%`;

        if (batteryIcon) {
          // Change the icon or color if it is charging
          if (battery.charging) {
            batteryIcon.textContent = "⚡";
            batteryIcon.style.color = "#4caf50"; // Green
          } else {
            batteryIcon.textContent = "🔋";
            batteryIcon.style.color = level <= 20 ? "#ff5252" : "#888";
          }
        }
      };

      // Execute at the start
      refreshBatteryUI();

      // Listen for changes
      battery.addEventListener('levelchange', refreshBatteryUI);
      battery.addEventListener('chargingchange', refreshBatteryUI);

    } catch (err) {
      console.warn("No se pudo acceder a la batería:", err);
    }
  }

  // 3. LISTENER: When main.js notifies that a game has been opened
  window.electronAPI.onUpdateLastGame((name) => {
    const display = document.getElementById('last-game-name');
    if (display && name) {
      display.textContent = name; // Changes it in the footer
      localStorage.setItem('lastPlayedGame', name); // Saves it on the PC
    }
  });

  function updateStatus(count, platformName) {
    const countElement = document.getElementById('game-count');
    const statusText = document.getElementById('status-text');

    let icon = "🎮";
    if (platformName.toLowerCase().includes("steam")) icon = "🔹";
    if (platformName.toLowerCase().includes("epic")) icon = "🔥";

    // If there is a change of games, we trigger the "Update Notice"
    if (countElement) {
      // Visual update effect
      countElement.style.color = "#fff"; // White glow
      countElement.style.textShadow = "0 0 15px #fff";

      setTimeout(() => {
        countElement.style.transition = "all 0.6s ease";
        countElement.style.color = ""; // Return to CSS color
        countElement.style.textShadow = "";

        countElement.innerHTML = `${icon} <strong>${count}</strong> juegos`;
      }, 200);
    }

    if (statusText) {
      statusText.textContent = `Ludix: ${platformName}`;
    }
  }


  window.electronAPI.onRefreshGameList(async () => {
    console.log("¡Refrescando tiempos de juego!");

    // If you use a function that loads games from Steam and Epic, call them here:
    if (typeof loadAllGames === 'function') {
      await loadAllGames();
    } else {
      // Or simply reload the current view
      location.reload();
    }
  });
  // Window buttons
  document.getElementById('minimizeBtn')?.addEventListener('click', () => window.electronAPI.minimizeWindow());
  document.getElementById('maximizeBtn')?.addEventListener('click', () => window.electronAPI.toggleMaximizeWindow());
  document.getElementById('closeBtn')?.addEventListener('click', () => window.electronAPI.closeWindow());

  // --- WINDOW CONTROL BUTTONS ---
  document.getElementById('minimizeBtn')?.addEventListener('click', () => {
    window.electronAPI.minimizeWindow();
  });

  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    // Send a message to Electron to show a small menu
    ipcRenderer.send('show-context-menu');
  });

  document.getElementById('maximizeBtn')?.addEventListener('click', () => {
    window.electronAPI.toggleMaximizeWindow();
  });

  document.getElementById('closeBtn')?.addEventListener('click', () => {
    window.electronAPI.closeWindow();
  });
});