function startClock() {
  const clockElement = document.getElementById('digital-clock');
  if (!clockElement) return;

  setInterval(() => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');

    // Usamos una clase o estilo directo para el parpadeo
    // Esto evita que el color "baile" al reconstruir el HTML
    const opacity = (now.getSeconds() % 2 === 0) ? "1" : "0.2";
    const separator = `<span style="opacity: ${opacity}">:</span>`;

    clockElement.innerHTML = `${h}${separator}${m}${separator}${s}`;
  }, 1000);
}

let isEditing = false;
let editingOldName = ""; // Para saber a cuál juego sobreescribir

document.addEventListener('DOMContentLoaded', async () => {
  let allSteamGames = [];
  let epicGames = [];
  startClock();
  loadLastGame();
  initStatusBar();
  updateBattery();

  // 1. CARGAR PANEL PRINCIPAL AL INICIO
  await renderHome();

  // Cargar datos en segundo plano
  try {
    epicGames = await window.electronAPI.getEpicGames();
    allSteamGames = await window.electronAPI.getSteamGames();
  } catch (err) { console.error(err); }

  // === LÓGICA DE PESTAÑAS ACTUALIZADA ===
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

      // Cambiar clases activas
      tabButtons.forEach(btn => btn.classList.remove('active'));
      views.forEach(view => view.classList.remove('active'));
      button.classList.add('active');
      document.getElementById(`${platform}-view`).classList.add('active');
      updateUnderline(button);

      // CARGAR CONTENIDO SEGÚN PESTAÑA
      if (platform === 'home') {
        await renderHome();
        const games = await window.electronAPI.getEpicGames();
        // Contamos cuántos tienen tiempo de juego (máximo 4 según tu lógica)
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

  // Inicializar subrayado
  const activeTab = document.querySelector('.tab-button.active');
  if (activeTab) updateUnderline(activeTab);

  // Búsqueda en Steam
  document.getElementById('searchInput')?.addEventListener('input', () => {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const filtered = allSteamGames.filter(game =>
      game.name.toLowerCase().includes(query)
    );
    renderSteamGames(filtered);
  });

  // === MODAL PARA AÑADIR JUEGO DE EPIC ===
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
  const confirmBtn = document.getElementById('confirmAddBtn');

  // Abrir modal
  document.getElementById('addEpicGameBtn')?.addEventListener('click', () => {
    gameNameInput.value = '';
    gameExeInput.value = '';
    imagePreview.innerHTML = '<span>🖼️</span>';
    addGameModal.style.display = 'flex';
  });

  // Cerrar modal
  cancelAddBtn?.addEventListener('click', () => {
    addGameModal.style.display = 'none';
  });

  // Seleccionar .exe
  browseExeBtn?.addEventListener('click', async () => {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Ejecutables', extensions: ['exe', 'bat'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      gameExeInput.value = result.filePaths[0];
    }
  });

  // Subir imagen
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

  // Renderizado
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

  function openEditModal(game) {
    isEditing = true;
    editingOldName = game.name;

    // Rellenamos los inputs con los datos actuales
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

    // 1. EL BUSCADOR (Solo se crea una vez)
    if (!existingSearch) {
      const searchContainer = document.createElement('div');
      searchContainer.className = 'search-container';
      searchContainer.innerHTML = `
            <div class="search-icon">🔍</div>
            <input type="text" id="epicSearchInput" placeholder="Buscar en Epic..." />
        `;
      epicView.insertBefore(searchContainer, list);

      document.getElementById('epicSearchInput').addEventListener('input', () => {
        const query = document.getElementById('epicSearchInput').value.toLowerCase().trim();
        window.electronAPI.getEpicGames().then(allGames => {
          const filtered = allGames.filter(game => game.name.toLowerCase().includes(query));
          renderEpicGames(filtered); // Volvemos a renderizar filtrado
        });
      });
    }

    // 2. MENSAJE SI ESTÁ VACÍO
    if (games.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:#777;width:100%;">Aún no tienes juegos añadidos.</p>';
      return;
    }

    // 3. GENERACIÓN DE TARJETAS (Aquí es donde va el botón de editar)
    games.forEach(game => {
      const card = createGameCard(game, 'epic');

      // Botón Editar
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

    // 1. Contenedor de imagen
    const imgContainer = document.createElement('div');
    imgContainer.className = 'game-image-container';

    // --- NUEVO: ICONO DE PLATAFORMA ---
    const iconContainer = document.createElement('div');
    iconContainer.className = 'platform-icon';
    const platformLogo = document.createElement('img');

    // Aquí puedes usar URLs de iconos o rutas locales si tienes los archivos
    if (platform === 'steam') {
      platformLogo.src = 'https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg';
    } else {
      // Logo de Epic o un mando genérico para manuales
      platformLogo.src = 'https://upload.wikimedia.org/wikipedia/commons/3/31/Epic_Games_logo.svg';
    }

    iconContainer.appendChild(platformLogo);
    imgContainer.appendChild(iconContainer);

    const img = document.createElement('img');
    img.className = 'game-image loaded';

    // Si es Steam usamos su CDN, si no, la imagen guardada o placeholder
    img.src = platform === 'steam'
      ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.id}/header.jpg`
      : (game.imageData || 'assets/placeholder.png');

    imgContainer.appendChild(img);
    card.appendChild(imgContainer);

    // 2. Título del juego
    const title = document.createElement('h3');
    title.className = 'game-title';
    title.textContent = game.name;
    card.appendChild(title);

    // 3. CONTADOR DE TIEMPO
    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'game-playtime';
    const totalMinutes = game.playTime || 0;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    timeDisplay.innerHTML = `<span>⏱ ${h}h ${m}m</span>`;
    card.appendChild(timeDisplay);

    // 4. Botones de borrar/editar (Para Epic y "Otros")
    if (platform !== 'steam') {
      const deleteBtn = document.createElement('button');
      deleteBtn.innerHTML = '×';
      deleteBtn.className = 'delete-game-btn';
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm(`¿Eliminar ${game.name}?`)) {
          await window.electronAPI.deleteEpicGame(game.name);
          // Refrescamos la vista actual
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
        document.getElementById('modalTitle').textContent = "Editar Juego";
        document.getElementById('confirmAddBtn').textContent = "Guardar Cambios";
        document.getElementById('addGameModal').style.display = 'flex';
      };

      card.appendChild(deleteBtn);
      card.appendChild(editBtn);
    }

    // 5. LÓGICA DE CLIC UNIFICADA (Steam y Epic cuentan horas ahora)
    card.addEventListener('click', () => {
      const originalTitle = title.textContent;

      // Feedback visual
      title.textContent = "⏱ Contando tiempo...";
      title.style.color = "var(--accent)";
      card.style.pointerEvents = "none";

      setTimeout(() => {
        title.textContent = originalTitle;
        title.style.color = "";
        card.style.pointerEvents = "auto";
      }, 5000);

      // LANZAMIENTO UNIVERSAL
      // Si es Steam, intentamos usar la ruta del ejecutable si la tienes, 
      // o el comando de steam si el main.js está preparado para manejarlo.
      if (platform === 'steam') {
        // Para Steam, lo ideal es que el exePath sea la ruta al .exe del juego
        // Si no la tienes, usaremos el ID para lanzarlo vía comando
        const steamPath = `steam://rungameid/${game.id}`;
        window.electronAPI.launchGame(steamPath, game.name);
      } else {
        // Epic y manuales
        window.electronAPI.launchGame(game.exePath, game.name);
      }
    });

    return card;
  }

  async function renderHome() {
    const homeView = document.getElementById('home-view');
    const header = homeView.querySelector('h2');

    // 1. Obtener nombre guardado o usar "Jugador"
    const userName = localStorage.getItem('ludix_user') || "Jugador";

    // Saludo dinámico según la hora
    const hora = new Date().getHours();
    let saludoBase = "¡A jugar!";
    if (hora >= 6 && hora < 13) saludoBase = "Buenos días";
    else if (hora >= 13 && hora < 20) saludoBase = "Buenas tardes";
    else saludoBase = "Buenas noches";

    // Insertamos el saludo con un span con ID para el nombre
    header.innerHTML = `${saludoBase}, <span id="user-display-name">${userName}</span>!`;

    // 2. Obtener juegos de AMBAS plataformas
    // getSteamGames ya viene con el playTime incluido desde el nuevo playtime.json
    const epicGames = await window.electronAPI.getEpicGames();
    const steamGames = await window.electronAPI.getSteamGames();

    // Combinamos las listas marcando su plataforma original
    const allGames = [
      ...epicGames.map(g => ({ ...g, platform: 'epic' })),
      ...steamGames.map(g => ({ ...g, platform: 'steam' }))
    ];

    // 3. Calcular estadísticas globales (Suma de minutos de todos los juegos)
    const totalMinutes = allGames.reduce((acc, g) => acc + (g.playTime || 0), 0);
    const totalH = Math.floor(totalMinutes / 60);

    // Gestión del subtítulo de estadísticas
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
    statsSub.textContent = `Has pasado ${totalH} horas disfrutando de tus juegos en Ludix.`;

    // 4. Preparar el contenedor
    const homeContainer = document.getElementById('top-games-list');
    if (!homeContainer) return;
    homeContainer.innerHTML = '';

    // 5. Filtrar y ordenar el Top 4 global
    const topGames = allGames
      .filter(g => (g.playTime || 0) > 0)
      .sort((a, b) => (b.playTime || 0) - (a.playTime || 0))
      .slice(0, 3);

    // Si no hay tiempo registrado aún
    if (topGames.length === 0) {
      homeContainer.innerHTML = `
            <div style="text-align:center; padding:40px; color:#555; width:100%; grid-column: 1 / -1;">
                <p>Aún no hay estadísticas de juego.</p>
                <p style="font-size: 0.8rem;">¡Inicia cualquier juego para empezar a ver tu actividad aquí!</p>
            </div>`;
      return;
    }

    // 6. Renderizar las tarjetas
    const fragment = document.createDocumentFragment();
    topGames.forEach(game => {
      // Usamos game.platform para que createGameCard decida si usa URL de Steam o imagen local
      const card = createGameCard(game, game.platform);
      card.classList.add('top-game-featured');
      fragment.appendChild(card);
    });

    homeContainer.appendChild(fragment);
  }

  function initStatusBar() {
    // --- RELOJ 24 HORAS ---
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

    // --- CARGAR ÚLTIMO JUEGO ---
    // Buscamos en el almacenamiento si hay algo guardado de sesiones anteriores
    const lastGameName = localStorage.getItem('lastPlayedGame');
    const lastGameDisplay = document.getElementById('last-game-name');

    if (lastGameDisplay && lastGameName) {
      lastGameDisplay.textContent = lastGameName;
    }

    // --- MONITOR DE RAM ---
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

  // 1. Para que la RAM se actualice sola cada 5 segundos
  async function updateRAM() {
    const ramElement = document.getElementById('ram-usage');
    if (!ramElement) return;

    setInterval(async () => {
      const ram = await window.electronAPI.getRamUsage();
      ramElement.textContent = `RAM: ${ram} MB`;
    }, 5000);
  }

  // 2. Para cargar el nombre que quedó guardado la última vez
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
          // Cambiar el icono o color si está cargando
          if (battery.charging) {
            batteryIcon.textContent = "⚡";
            batteryIcon.style.color = "#4caf50"; // Verde
          } else {
            batteryIcon.textContent = "🔋";
            batteryIcon.style.color = level <= 20 ? "#ff5252" : "#888";
          }
        }
      };

      // Ejecutar al inicio
      refreshBatteryUI();

      // Escuchar cambios
      battery.addEventListener('levelchange', refreshBatteryUI);
      battery.addEventListener('chargingchange', refreshBatteryUI);

    } catch (err) {
      console.warn("No se pudo acceder a la batería:", err);
    }
  }

  // 3. ESCUCHADOR: Cuando el main.js avisa que se abrió un juego
  window.electronAPI.onUpdateLastGame((name) => {
    const display = document.getElementById('last-game-name');
    if (display && name) {
      display.textContent = name; // Lo cambia en el footer
      localStorage.setItem('lastPlayedGame', name); // Lo guarda en el PC
    }
  });

  // renderer.js

  function updateStatus(count, platformName) {
    const countElement = document.getElementById('game-count');
    const statusText = document.getElementById('status-text');

    let icon = "🎮";
    if (platformName.toLowerCase().includes("steam")) icon = "🔹";
    if (platformName.toLowerCase().includes("epic")) icon = "🔥";

    // Si hay un cambio de juegos, disparamos el "Aviso de Actualización"
    if (countElement) {
      // Efecto visual de actualización
      countElement.style.color = "#fff"; // Brillo blanco
      countElement.style.textShadow = "0 0 15px #fff";

      setTimeout(() => {
        countElement.style.transition = "all 0.6s ease";
        countElement.style.color = ""; // Vuelve al color del CSS
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

    // Si usas una función que carga los juegos de Steam y Epic, llámalas aquí:
    if (typeof loadAllGames === 'function') {
      await loadAllGames();
    } else {
      // O simplemente recarga la vista actual
      location.reload();
    }
  });
  // Botones de ventana
  document.getElementById('minimizeBtn')?.addEventListener('click', () => window.electronAPI.minimizeWindow());
  document.getElementById('maximizeBtn')?.addEventListener('click', () => window.electronAPI.toggleMaximizeWindow());
  document.getElementById('closeBtn')?.addEventListener('click', () => window.electronAPI.closeWindow());

  // --- BOTONES DE CONTROL DE VENTANA ---
  document.getElementById('minimizeBtn')?.addEventListener('click', () => {
    window.electronAPI.minimizeWindow();
  });

  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    // Envía un mensaje a Electron para mostrar un menú pequeño
    ipcRenderer.send('show-context-menu');
  });

  document.getElementById('maximizeBtn')?.addEventListener('click', () => {
    window.electronAPI.toggleMaximizeWindow();
  });

  document.getElementById('closeBtn')?.addEventListener('click', () => {
    window.electronAPI.closeWindow();
  });
});