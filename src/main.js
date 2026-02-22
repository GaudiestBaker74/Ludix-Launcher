// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs').promises;

const { Menu, Tray, Notification } = require('electron');
if (process.platform === 'win32') {
  app.setAppUserModelId("Ludix Launcher"); // Nombre interno de tu app
}

function sendProNotification(title, message) {
  // Definimos la ruta del icono de forma segura para el Build
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'build', 'logo.png')
    : path.join(__dirname, 'build', 'logo.png');

  const notification = new Notification({
    title: title,
    body: message,
    icon: iconPath,
    silent: false, // Cambia a true si no quieres sonido
    timeoutType: 'default',
    urgency: 'normal'
  });

  notification.show();

  // Si el usuario hace clic en la notificación, abrimos el Launcher
  notification.on('click', () => {
    if (win) {
      win.show();
      win.focus();
    }
  });
}

let keepInTray = true;

let tray = null;
function createTray() {
  // IMPORTANTE: Ajustamos la ruta a la carpeta build
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'build', 'logo.png') // Ruta cuando está instalada
    : path.join(__dirname, 'build', 'logo.png');           // Ruta cuando programas

  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Ludix Launcher v3.1', enabled: false },
    { type: 'separator' },
    { label: 'Restaurar Ventana', click: () => win.show() },
    {
      label: 'Opciones Rápidas',
      submenu: [
        { label: 'Limpiar Consola', click: () => win.webContents.send('clear-terminal') },
        { label: 'Reiniciar Kernel', role: 'reload' }
      ]
    },
    { type: 'separator' },
    {
      label: 'Cerrar Completamente',
      click: () => {
        app.isQuitting = true; // Variable para permitir el cierre real
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Ludix OS - Segundo plano activo');
  tray.setContextMenu(contextMenu);

  // Si haces click normal al icono, se abre la app
  tray.on('click', () => {
    win.isVisible() ? win.hide() : win.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.whenReady().then(() => {
  createWindow();
});

const EPIC_GAMES_PATH = path.join(app.getPath('userData'), 'epic-games.json');

function notificarSesionFinalizada(juego, minutos) {
  // Convertir minutos a un formato más legible (ej: 1h 15min)
  const horas = Math.floor(minutos / 60);
  const minsRestantes = minutos % 60;
  let tiempoTexto = "";

  if (horas > 0) {
    tiempoTexto = `${horas}h ${minsRestantes}min`;
  } else {
    tiempoTexto = `${minutos} min`;
  }

  const notificacion = new Notification({
    title: '🎮 ¡Sesión de juego finalizada!',
    body: `Has jugado a ${juego} durante ${tiempoTexto}. Tu tiempo total ha sido actualizado.`,
    icon: path.join(__dirname, 'build/logo.png'), // Asegúrate de tener tu logo aquí
    timeoutType: 'default'
  });

  notificacion.on('click', () => {
    if (win) {
      win.show();
      win.focus();
    }
  });

  notificacion.show();
}

// === FUNCIONES AUXILIARES ===
function parseLibraryFolders(content) {
  const lines = content.split('\n');
  const paths = [];
  for (const line of lines) {
    const match = line.match(/"([^"]+)"\s+"([^"]+)"/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].trim();
    if (key === 'path') {
      paths.push(value);
    } else if (/^\d+$/.test(key)) {
      if (
        (process.platform === 'win32' && /^[A-Za-z]:[\\\/]/.test(value)) ||
        (process.platform !== 'win32' && value.startsWith('/'))
      ) {
        paths.push(value);
      }
    }
  }
  return paths;
}

async function getSteamLibraryPaths() {
  let mainSteamPath;
  if (process.platform === 'win32') {
    try {
      const { spawnSync } = require('child_process');
      const result = spawnSync('reg', ['query', 'HKEY_CURRENT_USER\\Software\\Valve\\Steam', '/v', 'SteamPath'], {
        encoding: 'utf8',
        windowsHide: true
      });
      if (result.status === 0) {
        const match = result.stdout.match(/SteamPath\s+REG_SZ\s+(.+)/);
        if (match) {
          mainSteamPath = match[1].trim().replace(/\\\\/g, '\\');
        }
      }
    } catch (e) {
      console.warn('No se pudo leer el registro de Steam.');
    }
    if (!mainSteamPath) {
      const commonPaths = [
        'C:\\Program Files (x86)\\Steam',
        'C:\\Program Files\\Steam',
        'D:\\Steam',
        'E:\\Steam',
        'C:\\Steam'
      ];
      for (const p of commonPaths) {
        try {
          await fs.access(path.join(p, 'Steam.exe'));
          mainSteamPath = p;
          break;
        } catch { }
      }
    }
    if (!mainSteamPath) mainSteamPath = 'C:\\Program Files (x86)\\Steam';
  } else if (process.platform === 'darwin') {
    mainSteamPath = path.join(process.env.HOME, 'Library', 'Application Support', 'Steam');
  } else {
    const linuxPaths = [
      path.join(process.env.HOME, '.steam', 'steam'),
      path.join(process.env.HOME, '.local', 'share', 'Steam')
    ];
    for (const p of linuxPaths) {
      try {
        await fs.access(p);
        mainSteamPath = p;
        break;
      } catch { }
    }
    if (!mainSteamPath) mainSteamPath = linuxPaths[0];
  }

  const libraryFoldersPath = path.join(mainSteamPath, 'steamapps', 'libraryfolders.vdf');
  const paths = [path.join(mainSteamPath, 'steamapps')];
  try {
    const vdfContent = await fs.readFile(libraryFoldersPath, 'utf8');
    const extraPaths = parseLibraryFolders(vdfContent);
    for (const folderPath of extraPaths) {
      let normalizedPath = folderPath;
      if (process.platform === 'win32') {
        normalizedPath = folderPath.replace(/\//g, '\\');
      }
      const steamappsPath = path.join(normalizedPath, 'steamapps');
      try {
        await fs.access(steamappsPath);
        if (!paths.includes(steamappsPath)) {
          paths.push(steamappsPath);
        }
      } catch {
        console.warn(`Biblioteca omitida: ${steamappsPath}`);
      }
    }
  } catch (err) {
    console.warn(`No se encontró libraryfolders.vdf: ${err.message}`);
  }
  return paths;
}

async function findGamesInSteamAppsFolder(folderPath) {
  const games = [];
  try {
    const files = await fs.readdir(folderPath);
    const acfFiles = files.filter(f => f.endsWith('.acf') && f.startsWith('appmanifest_'));
    for (const file of acfFiles) {
      try {
        const content = await fs.readFile(path.join(folderPath, file), 'utf8');
        const idMatch = content.match(/"appid"\s+"?(\d+)"?/);
        const nameMatch = content.match(/"name"\s+"([^"\n]+)"/);
        if (idMatch && nameMatch) {
          games.push({
            id: idMatch[1],
            name: nameMatch[1].trim()
          });
        }
      } catch (err) {
        console.error(`Error al procesar ${file}:`, err.message);
      }
    }
  } catch (err) {
    console.error(`Error al leer ${folderPath}:`, err.message);
  }
  return games;
}

// === GESTIÓN DE EPIC GAMES ===
const epicGamesFile = path.join(app.getPath('userData'), 'epic-games.json');

async function loadEpicGames() {
  try {
    const data = await fs.readFile(epicGamesFile, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveEpicGames(games) {
  await fs.writeFile(epicGamesFile, JSON.stringify(games, null, 2));
}

// === HANDLERS IPC (SOLO UNA VEZ) ===
ipcMain.on('minimize-window', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window.minimize();
});

ipcMain.on('toggle-maximize-window', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window.isMaximized()) {
    window.unmaximize();
  } else {
    window.maximize();
  }
});

let isProcessingClose = false;

ipcMain.on('close-window', (event) => {
  if (isProcessingClose) return; // Si ya se está cerrando, ignoramos

  isProcessingClose = true;
  const window = BrowserWindow.fromWebContents(event.sender);

  if (keepInTray) {
    window.hide();
    sendProNotification(
      'Launcher en segundo plano',
      'Seguiré contando tu tiempo de juego desde aquí.'
    );

    // Desbloqueamos después de 1 segundo por si el usuario vuelve a abrir y cerrar
    setTimeout(() => { isProcessingClose = false; }, 1000);
  } else {
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // No ponemos app.quit() aquí. Si lo tienes, BÓRRALO.
  }
});

// Steam
ipcMain.handle('get-steam-games', async () => {
  const libraryPaths = await getSteamLibraryPaths();
  let allGames = [];

  // 1. LEER EL ARCHIVO DE TIEMPOS PRIMERO
  let times = {};
  try {
    const data = await fs.readFile(PLAYTIME_PATH, 'utf8');
    times = JSON.parse(data);
  } catch (e) {
    times = {}; // Si no hay archivo, empezamos de cero
  }

  for (const libPath of libraryPaths) {
    const games = await findGamesInSteamAppsFolder(libPath);
    allGames.push(...games);
  }

  // 2. MAPEAR LOS JUEGOS Y ASIGNAR EL TIEMPO GUARDADO
  return allGames.map(game => {
    return {
      ...game,
      // IMPORTANTE: Buscamos en el JSON por el nombre del juego
      playTime: times[game.name] || 0,
      platform: 'steam'
    };
  }).filter((game, index, self) =>
    index === self.findIndex(g => g.id === game.id)
  );
});

// Obtener juegos
ipcMain.handle('get-epic-games', async () => {
  try {
    const data = await fs.readFile(EPIC_GAMES_PATH, 'utf8');
    let games = JSON.parse(data);

    // Leer tiempos actuales
    let times = {};
    try {
      const timeData = await fs.readFile(PLAYTIME_PATH, 'utf8');
      times = JSON.parse(timeData);
    } catch (e) { }

    // Unir el juego con su tiempo real
    return games.map(g => ({
      ...g,
      playTime: times[g.name] || 0
    }));
  } catch {
    return [];
  }
});

// Eliminar juego
ipcMain.handle('delete-epic-game', async (event, gameName) => {
  try {
    const data = await fs.readFile(EPIC_GAMES_PATH, 'utf8');
    let games = JSON.parse(data);
    const nuevosJuegos = games.filter(g => g.name !== gameName);
    await fs.writeFile(EPIC_GAMES_PATH, JSON.stringify(nuevosJuegos, null, 2));
    return { success: true };
  } catch (error) {
    console.error("Error al borrar:", error);
    return { success: false };
  }
});

ipcMain.handle('add-epic-game', async (event, game) => {
  try {
    let games = [];
    try {
      const data = await fs.readFile(EPIC_GAMES_PATH, 'utf8');
      // Intentamos parsear, si el archivo está vacío JSON.parse da error
      games = data ? JSON.parse(data) : [];
    } catch (e) {
      games = []; // El archivo no existe o está corrupto
    }

    // Evitar duplicados por nombre
    if (games.find(g => g.name === game.name)) {
      return { success: false, error: "El juego ya existe" };
    }

    // Añadir el nuevo juego con seguridad
    const newGame = {
      name: game.name || 'Juego sin nombre',
      exePath: game.exePath || '',
      imageData: game.imageData || '', // Si es un string Base64 muy largo, está bien
      playTime: 0
    };

    games.push(newGame);

    // Escribimos de forma atómica para evitar que el archivo se rompa
    await fs.writeFile(EPIC_GAMES_PATH, JSON.stringify(games, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    console.error("CRASH EVITADO:", error);
    return { success: false, error: error.message };
  }
});

// Editar un juego existente
ipcMain.handle('update-epic-game', async (event, { oldName, updatedGame }) => {
  try {
    const data = await fs.readFile(EPIC_GAMES_PATH, 'utf8');
    let games = JSON.parse(data);

    // Buscamos el índice del juego original por su nombre antiguo
    const index = games.findIndex(g => g.name === oldName);

    if (index !== -1) {
      // Mantener el tiempo de juego original si no se envía uno nuevo
      updatedGame.playTime = games[index].playTime || 0;
      games[index] = updatedGame;

      await fs.writeFile(EPIC_GAMES_PATH, JSON.stringify(games, null, 2));
      return { success: true };
    }
    return { success: false, error: "Juego no encontrado" };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('launch-epic-game', async (event, exePath, gameName) => {
  event.sender.send('update-last-game', gameName);
  const startTime = Date.now();

  console.log(`>>> Iniciando sesión de: ${gameName}`);

  // 1. Lanzamos el juego pero NO esperamos el resultado en el callback
  exec(`start "" "${exePath}"`);

  // 2. MONITOR DE PROCESO (Para que no se cierre a los 0 min)
  let juegoDetectado = false;

  const monitor = setInterval(() => {
    // Buscamos en la lista de procesos de Windows
    // Limpiamos el nombre: "1v1.LOL" -> "1v1"
    const searchName = gameName.split('.')[0].split(' ')[0].toLowerCase();

    exec('tasklist /FI "STATUS eq running" /NH', async (err, stdout) => { // <--- AÑADIR ASYNC AQUÍ
      if (err) return;

      const isRunning = stdout.toLowerCase().includes(searchName);

      if (isRunning) {
        if (!juegoDetectado) {
          juegoDetectado = true;
        }
      } else if (juegoDetectado) {
        clearInterval(monitor);

        const endTime = Date.now();
        const minutesPlayed = Math.round((endTime - startTime) / 1000 / 60);

        if (minutesPlayed > 0) {
          // Ahora ya no dará error porque la función es 'async'
          await updatePlayTime(gameName, minutesPlayed);
          event.sender.send('refresh-game-list');
        }
      }
    });
  }, 10000); // Revisa cada 10 segundos

  return { success: true };
});

ipcMain.handle('launch-game', async (event, path, gameName) => {
  if (!path) return { success: false, error: "Falta ruta" };

  event.sender.send('update-last-game', gameName);

  let launchCommand;
  const isSteam = !path.includes('\\') && !path.includes('/') && !isNaN(path);

  if (isSteam) {
    launchCommand = `start steam://rungameid/${path}`;
  } else {
    launchCommand = `start "" "${path}"`;
  }

  const startTime = Date.now();
  let juegoDetectado = false;
  let isSaving = false;

  // Ejecutamos el juego
  exec(launchCommand);

  const monitor = setInterval(() => {
    // --- MEJORA CRÍTICA: Filtro de búsqueda inteligente ---
    // 1. Agarramos la primera palabra del nombre (ej: "Geometry Dash" -> "Geometry")
    // 2. Quitamos puntos y símbolos (ej: "1v1.LOL" -> "1v1")
    const filtro = gameName.split(/[ .]/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    exec('tasklist /NH', async (err, stdout) => {
      if (err || isSaving) return;

      const procesos = stdout.toLowerCase();
      const estaCorriendo = procesos.includes(filtro);

      if (estaCorriendo) {
        if (!juegoDetectado) {
          console.log(`>>> [SISTEMA] Detectado: ${filtro}`);
          juegoDetectado = true;
        }
      }
      else if (juegoDetectado && !isSaving) {
        isSaving = true;
        clearInterval(monitor);

        // Calcular el tiempo transcurrido
        const minutosJugados = Math.round((Date.now() - startTime) / 1000 / 60);

        console.log(`>>> [SISTEMA] Guardando ${minutosJugados} minutos para ${gameName}`);

        // 1. Guardar en el archivo JSON
        await updatePlayTime(gameName, minutosJugados);

        // 2. DISPARAR LA NOTIFICACIÓN DE WINDOWS
        // Solo notificamos si ha jugado al menos 1 minuto
        if (minutosJugados >= 1) {
          notificarSesionFinalizada(gameName, minutosJugados);
        }

        // 3. Avisar al renderer para que actualice la interfaz
        event.sender.send('refresh-game-list');
      }
    });
  }, 5000); // Revisar cada 5 segundos

  return { success: true };
});

const PLAYTIME_PATH = path.join(app.getPath('userData'), 'playtime.json');

// Función única para guardar tiempo de CUALQUIER plataforma
async function updatePlayTime(gameName, additionalMinutes) {
  try {
    const PLAYTIME_PATH = path.join(app.getPath('userData'), 'playtime.json');
    let times = {};

    try {
      const data = await fs.readFile(PLAYTIME_PATH, 'utf8');
      times = JSON.parse(data);
    } catch (e) { times = {}; }

    // Sumar tiempo
    times[gameName] = (times[gameName] || 0) + additionalMinutes;

    await fs.writeFile(PLAYTIME_PATH, JSON.stringify(times, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error("Error al guardar:", err);
    return false;
  }
}

// Diálogos
ipcMain.handle('show-open-dialog', async (event, options) => {
  return await dialog.showOpenDialog(options);
});

// Guardar imagen
ipcMain.handle('save-image', async (event, sourcePath, name) => {
  try {
    if (!sourcePath || !name) {
      return { success: false, error: 'Ruta o nombre inválido' };
    }
    const userDataPath = app.getPath('userData');
    const imagesDir = path.join(userDataPath, 'epic-images');
    await fs.mkdir(imagesDir, { recursive: true });
    const ext = path.extname(sourcePath).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
      return { success: false, error: 'Formato no soportado' };
    }
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
    const destPath = path.join(imagesDir, `${safeName}_${Date.now()}${ext}`);
    await fs.copyFile(sourcePath, destPath);
    return { success: true, path: destPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-ram-usage', async () => {
  // Obtenemos la memoria privada del proceso en bytes y la pasamos a MB
  const memory = await process.getProcessMemoryInfo();
  return Math.round(memory.private / 1024);
});

ipcMain.handle('reset-all-times', async () => {
  try {
    const PLAYTIME_PATH = path.join(app.getPath('userData'), 'playtime.json');
    await fs.writeFile(PLAYTIME_PATH, JSON.stringify({}, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
});

let win; // Variable global para la ventana

function createWindow() {
  // Si la ventana ya existe, no creamos otra
  if (win) return;

  win = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false,
    backgroundColor: '#121212',
    icon: path.join(__dirname, 'build/logo.png'),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');
}

// GESTIÓN DE INSTANCIA ÚNICA
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow(); // <--- ÚNICA LLAMADA PERMITIDA
  });
}

// IMPORTANTE: Evita que macOS cree una segunda ventana al hacer clic en el dock
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.on('show-window', () => {
  if (win) {
    win.show();
    win.focus(); // La trae al frente de todo
  }
});

// === INICIAR APP ===
app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});