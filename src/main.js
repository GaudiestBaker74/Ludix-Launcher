// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs').promises;

const { Menu, Tray, Notification } = require('electron');
if (process.platform === 'win32') {
  app.setAppUserModelId("Ludix Launcher"); // Internal name of the app
}

function sendProNotification(title, message) {
  // Define the icon path securely for the Build
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'build', 'logo.png')
    : path.join(__dirname, 'build', 'logo.png');

  const notification = new Notification({
    title: title,
    body: message,
    icon: iconPath,
    silent: false,
    timeoutType: 'default',
    urgency: 'normal'
  });

  notification.show();

  // If the user clicks on the notification, we open the Launcher
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
  // IMPORTANT: Adjust the path to the build folder
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'build', 'logo.png') // Path when installed
    : path.join(__dirname, 'build', 'logo.png');    // Path when programming

  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Ludix Launcher v3.1', enabled: false },
    { type: 'separator' },
    { label: 'Restore Window', click: () => win.show() },
    {
      label: 'Quick Options',
      submenu: [
        { label: 'Clear Console', click: () => win.webContents.send('clear-terminal') },
        { label: 'Restart Kernel', role: 'reload' }
      ]
    },
    { type: 'separator' },
    {
      label: 'Close Completely',
      click: () => {
        app.isQuitting = true; // Variable to allow the real closing
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Ludix OS - Background active');
  tray.setContextMenu(contextMenu);

  // If you click normally on the icon, the app opens
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
    title: '🎮 Game session ended!',
    body: `You have played ${juego} for ${tiempoTexto}. Your total time has been updated.`,
    icon: path.join(__dirname, 'build/logo.png'), // Make sure you have your logo here
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
      console.warn('Could not read Steam registry.');
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
        console.warn(`Library omitted: ${steamappsPath}`);
      }
    }
  } catch (err) {
    console.warn(`Could not find libraryfolders.vdf: ${err.message}`);
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
        console.error(`Error processing ${file}:`, err.message);
      }
    }
  } catch (err) {
    console.error(`Error reading ${folderPath}:`, err.message);
  }
  return games;
}

// === EPIC GAMES MANAGEMENT ===
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

// === HANDLERS IPC ===
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
  if (isProcessingClose) return; // If it's already closing, ignore

  isProcessingClose = true;
  const window = BrowserWindow.fromWebContents(event.sender);

  if (keepInTray) {
    window.hide();
    sendProNotification(
      'Launcher in background',
      'I will continue to count your game time from here.'
    );

    // Unblock after 1 second in case the user opens and closes again
    setTimeout(() => { isProcessingClose = false; }, 1000);
  } else {
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
  }
});

// Steam
ipcMain.handle('get-steam-games', async () => {
  const libraryPaths = await getSteamLibraryPaths();
  let allGames = [];

  // 1. READ THE PLAYTIME FILE FIRST
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

  // 2. MAP THE GAMES AND ASSIGN THE SAVED TIME
  return allGames.map(game => {
    return {
      ...game,
      // IMPORTANT: We look in the JSON for the game name
      playTime: times[game.name] || 0,
      platform: 'steam'
    };
  }).filter((game, index, self) =>
    index === self.findIndex(g => g.id === game.id)
  );
});

// Get Epic Games
ipcMain.handle('get-epic-games', async () => {
  try {
    const data = await fs.readFile(EPIC_GAMES_PATH, 'utf8');
    let games = JSON.parse(data);

    // Read current times
    let times = {};
    try {
      const timeData = await fs.readFile(PLAYTIME_PATH, 'utf8');
      times = JSON.parse(timeData);
    } catch (e) { }

    // Link the game with its real time
    return games.map(g => ({
      ...g,
      playTime: times[g.name] || 0
    }));
  } catch {
    return [];
  }
});

// Delete Epic Game
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
      // Try to parse, if the file is empty JSON.parse gives an error
      games = data ? JSON.parse(data) : [];
    } catch (e) {
      games = []; // The file does not exist or is corrupt
    }

    // Avoid duplicates by name
    if (games.find(g => g.name === game.name)) {
      return { success: false, error: "The game already exists" };
    }

    // Add the new game safely
    const newGame = {
      name: game.name || 'Game without name',
      exePath: game.exePath || '',
      imageData: game.imageData || '', // If it's a very long Base64 string, it's fine
      playTime: 0
    };

    games.push(newGame);

    // Write atomically to avoid corrupting the file
    await fs.writeFile(EPIC_GAMES_PATH, JSON.stringify(games, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    console.error("CRASH AVOIDED:", error);
    return { success: false, error: error.message };
  }
});

// Edit an existing game
ipcMain.handle('update-epic-game', async (event, { oldName, updatedGame }) => {
  try {
    const data = await fs.readFile(EPIC_GAMES_PATH, 'utf8');
    let games = JSON.parse(data);

    // We look for the index of the original game by its old name
    const index = games.findIndex(g => g.name === oldName);

    if (index !== -1) {
      // Keep the original play time if a new one is not sent
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

  console.log(`>>> Starting session of: ${gameName}`);

  // 1. Launch the game but DO NOT wait for the result in the callback
  exec(`start "" "${exePath}"`);

  // 2. PROCESS MONITOR (So it doesn't close at 0 min)
  let juegoDetectado = false;

  const monitor = setInterval(() => {
    // We look in the Windows process list
    // We clean the name: "1v1.LOL" -> "1v1"
    const searchName = gameName.split('.')[0].split(' ')[0].toLowerCase();

    exec('tasklist /FI "STATUS eq running" /NH', async (err, stdout) => { // <--- ADD ASYNC HERE
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
          // Now it won't give an error because the function is 'async'
          await updatePlayTime(gameName, minutesPlayed);
          event.sender.send('refresh-game-list');
        }
      }
    });
  }, 10000); // Check every 10 seconds

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

  // Execute the game
  exec(launchCommand);

  const monitor = setInterval(() => {
    // --- CRITICAL IMPROVEMENT: Smart search filter ---
    // 1. Take the first word of the name (e.g., "Geometry Dash" -> "Geometry")
    // 2. Remove dots and symbols (e.g., "1v1.LOL" -> "1v1")
    const filtro = gameName.split(/[ .]/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    exec('tasklist /NH', async (err, stdout) => {
      if (err || isSaving) return;

      const procesos = stdout.toLowerCase();
      const estaCorriendo = procesos.includes(filtro);

      if (estaCorriendo) {
        if (!juegoDetectado) {
          console.log(`>>> [SYSTEM] Detected: ${filtro}`);
          juegoDetectado = true;
        }
      }
      else if (juegoDetectado && !isSaving) {
        isSaving = true;
        clearInterval(monitor);

        // Calculate elapsed time
        const minutosJugados = Math.round((Date.now() - startTime) / 1000 / 60);

        console.log(`>>> [SYSTEM] Saving ${minutosJugados} minutes for ${gameName}`);

        // 1. Save to JSON file
        await updatePlayTime(gameName, minutosJugados);

        // 2. TRIGGER WINDOWS NOTIFICATION
        // Only notify if he has played at least 1 minute
        if (minutosJugados >= 1) {
          notificarSesionFinalizada(gameName, minutosJugados);
        }

        // 3. Tell the renderer to update the interface
        event.sender.send('refresh-game-list');
      }
    });
  }, 5000); // Check every 5 seconds

  return { success: true };
});

const PLAYTIME_PATH = path.join(app.getPath('userData'), 'playtime.json');

// Single function to save time from ANY platform
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
  // Get private memory of the process in bytes and convert to MB
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

let win; // Global variable for the window

function createWindow() {
  // If the window already exists, we don't create another one
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

// SINGLE INSTANCE MANAGEMENT
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
    createWindow(); // <--- ONLY ALLOWED CALL
  });
}

// IMPORTANT: Prevents macOS from creating a second window when clicking the dock
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.on('show-window', () => {
  if (win) {
    win.show();
    win.focus(); // Bring it to the front
  }
});

// === START APP ===
app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});