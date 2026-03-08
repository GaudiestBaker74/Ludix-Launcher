const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, Notification, nativeImage, globalShortcut, screen, shell } = require('electron');
const Parser = require('rss-parser');
const rssParser = new Parser({
  headers: { 'User-Agent': 'LudixLauncher/1.0.0' }
});
let rpc;
try {
  const DiscordRPC = require('discord-rpc');
  DiscordRPC.register('1480284364402200656');
  rpc = new DiscordRPC.Client({ transport: 'ipc' });
  rpc.login({ clientId: '1480284364402200656' }).catch(() => { });
} catch (e) {
  console.log('Discord RPC not available');
}
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');


if (process.platform === 'win32') {
  app.setAppUserModelId("com.gaudiestbaker74.ludix_launcher");
}

app.isQuitting = false;

// ── Data paths ───────────────────────────────────────
const PLAYTIME_PATH = path.join(app.getPath('userData'), 'playtime.json');
const PLAYTIME_LOG_PATH = path.join(app.getPath('userData'), 'playtime-log.json');
const EPIC_GAMES_PATH = path.join(app.getPath('userData'), 'epic-games.json');
const OTHER_GAMES_PATH = path.join(app.getPath('userData'), 'other-games.json');
const RETRO_GAMES_PATH = path.join(app.getPath('userData'), 'retro-games.json');
const STEAM_COVERS_PATH = path.join(app.getPath('userData'), 'steam-covers.json');
// Define paths & constants
const RESOURCES_PATH = app.isPackaged ? path.join(process.resourcesPath, 'assets') : path.join(__dirname, 'assets');
const DEFAULT_BG = 'url("assets/bg.jpg")';
const STEAM_CORES = path.join(app.getPath('userData'), 'steam-covers.json');

// Memory cache for RSS
let cachedNews = null;
let lastNewsFetch = 0;

function ensureDataFiles() {
  if (!fsSync.existsSync(PLAYTIME_PATH)) fsSync.writeFileSync(PLAYTIME_PATH, '{}');
  if (!fsSync.existsSync(OTHER_GAMES_PATH)) fsSync.writeFileSync(OTHER_GAMES_PATH, '[]');
  if (!fsSync.existsSync(RETRO_GAMES_PATH)) fsSync.writeFileSync(RETRO_GAMES_PATH, '[]');
  if (!fsSync.existsSync(STEAM_COVERS_PATH)) fsSync.writeFileSync(STEAM_COVERS_PATH, '{}');
}

// ═══════════════════════════════════════════════════════
// PLATFORM HELPERS
// ═══════════════════════════════════════════════════════

/** Build the command to launch an executable cross-platform */
function buildLaunchCommand(exePath) {
  if (process.platform === 'win32') {
    // Handles UNC paths and spaces
    return { cmd: 'cmd', args: ['/c', 'start', '', exePath] };
  } else if (process.platform === 'darwin') {
    // If it's a .app bundle use 'open', else exec directly
    if (exePath.endsWith('.app')) {
      return { cmd: 'open', args: [exePath] };
    }
    return { cmd: exePath, args: [] };
  } else {
    // Linux / Arch
    return { cmd: exePath, args: [] };
  }
}

/** Launch a game and return its child process */
function launchProcess(exePath) {
  const { cmd, args } = buildLaunchCommand(exePath);
  return spawn(cmd, args, { detached: true, stdio: 'ignore', shell: process.platform === 'win32' });
}

/** Cross-platform running process list — returns Promise<string> (process names, lowercased) */
function getRunningProcesses() {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32'
      ? 'tasklist /NH'
      : 'ps aux';
    exec(cmd, (err, stdout) => resolve(err ? '' : stdout.toLowerCase()));
  });
}

/** Cross-platform "steam://rungameid" launch */
function launchSteamGame(id) {
  const url = `steam://rungameid/${id}`;
  if (process.platform === 'win32') {
    exec(`start "" "${url}"`);
  } else if (process.platform === 'darwin') {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

// ═══════════════════════════════════════════════════════
// NOTIFICATIONS + TRAY
// ═══════════════════════════════════════════════════════

function sendProNotification(title, message) {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'build', 'logo.png')
    : path.join(__dirname, 'build', 'logo.png');

  const notification = new Notification({ title, body: message, icon: iconPath, silent: false, timeoutType: 'default' });
  notification.show();
  notification.on('click', () => { if (win) { win.show(); win.focus(); } });
}

let keepInTray = true;
let tray = null;

function createTray() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'build', 'logo.png')
    : path.join(__dirname, 'build', 'logo.png');

  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) console.error("Icon is empty! Check path: " + iconPath);

  try { tray = new Tray(icon); } catch (error) { console.error("Failed to create Tray:", error); return; }

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Ludix Launcher — Beta', enabled: false },
    { type: 'separator' },
    { label: 'Restore Window', click: () => { if (win) win.show(); } },
    {
      label: 'Quick Options', submenu: [
        { label: 'Clear Console', click: () => { if (win) win.webContents.send('clear-terminal'); } },
        { label: 'Restart Kernel', role: 'reload' }
      ]
    },
    { type: 'separator' },
    { label: 'Close Completely', click: () => { app.isQuitting = true; app.quit(); } }
  ]);

  tray.setToolTip('Ludix — Background active');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (!win) createWindow();
    else win.isVisible() ? win.hide() : win.show();
  });
  console.log("Tray created successfully.");
}

function notifySessionEnded(game, minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const timeText = h > 0 ? `${h}h ${m}min` : `${minutes} min`;
  const n = new Notification({
    title: '🎮 Game session ended!',
    body: `You played ${game} for ${timeText}.`,
    icon: path.join(__dirname, 'build/logo.png'),
    timeoutType: 'default'
  });
  n.on('click', () => { if (win) { win.show(); win.focus(); } });
  n.show();
}

// ═══════════════════════════════════════════════════════
// STEAM DETECTION (cross-platform)
// ═══════════════════════════════════════════════════════

function parseLibraryFolders(content) {
  const paths = [];
  for (const line of content.split('\n')) {
    const match = line.match(/"([^"]+)"\s+"([^"]+)"/);
    if (!match) continue;
    const [, key, value] = match;
    if (key === 'path') {
      paths.push(value.trim());
    } else if (/^\d+$/.test(key)) {
      if (
        (process.platform === 'win32' && /^[A-Za-z]:[\\/]/.test(value)) ||
        (process.platform !== 'win32' && value.startsWith('/'))
      ) {
        paths.push(value.trim());
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
      const result = spawnSync('reg', ['query', 'HKEY_CURRENT_USER\\Software\\Valve\\Steam', '/v', 'SteamPath'], { encoding: 'utf8', windowsHide: true });
      if (result.status === 0) {
        const m = result.stdout.match(/SteamPath\s+REG_SZ\s+(.+)/);
        if (m) mainSteamPath = m[1].trim().replace(/\\\\/g, '\\');
      }
    } catch (e) { /* ignore */ }

    if (!mainSteamPath) {
      for (const p of ['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam', 'D:\\Steam', 'E:\\Steam', 'C:\\Steam']) {
        try { await fs.access(path.join(p, 'Steam.exe')); mainSteamPath = p; break; } catch { }
      }
    }
    mainSteamPath = mainSteamPath || 'C:\\Program Files (x86)\\Steam';

  } else if (process.platform === 'darwin') {
    mainSteamPath = path.join(os.homedir(), 'Library', 'Application Support', 'Steam');

  } else {
    // Linux / Arch
    for (const p of [
      path.join(os.homedir(), '.steam', 'steam'),
      path.join(os.homedir(), '.local', 'share', 'Steam'),
      path.join(os.homedir(), '.var', 'app', 'com.valvesoftware.Steam', 'data', 'Steam') // Flatpak
    ]) {
      try { await fs.access(p); mainSteamPath = p; break; } catch { }
    }
    mainSteamPath = mainSteamPath || path.join(os.homedir(), '.local', 'share', 'Steam');
  }

  const libraryFoldersPath = path.join(mainSteamPath, 'steamapps', 'libraryfolders.vdf');
  const paths = [path.join(mainSteamPath, 'steamapps')];

  try {
    const vdfContent = await fs.readFile(libraryFoldersPath, 'utf8');
    for (const folderPath of parseLibraryFolders(vdfContent)) {
      let normalized = process.platform === 'win32' ? folderPath.replace(/\//g, '\\') : folderPath;
      const steamappsPath = path.join(normalized, 'steamapps');
      try { await fs.access(steamappsPath); if (!paths.includes(steamappsPath)) paths.push(steamappsPath); } catch { }
    }
  } catch (e) { /* no extra libraries */ }

  return paths;
}

async function findGamesInSteamAppsFolder(folderPath) {
  const games = [];
  try {
    const files = (await fs.readdir(folderPath)).filter(f => f.endsWith('.acf') && f.startsWith('appmanifest_'));
    for (const file of files) {
      try {
        const content = await fs.readFile(path.join(folderPath, file), 'utf8');
        const idMatch = content.match(/"appid"\s+"?(\d+)"?/);
        const nameMatch = content.match(/"name"\s+"([^"\n]+)"/);
        if (idMatch && nameMatch) games.push({ id: idMatch[1], name: nameMatch[1].trim() });
      } catch (e) { /* skip bad file */ }
    }
  } catch (e) { /* skip bad folder */ }
  return games;
}

// ═══════════════════════════════════════════════════════
// EPIC MANIFEST READING (cross-platform, reads .item files)
// ═══════════════════════════════════════════════════════

/** Get path(s) to search for Epic manifests by platform */
function getEpicManifestDirs() {
  if (process.platform === 'win32') {
    return [
      'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests',
      path.join(os.homedir(), 'AppData', 'Local', 'EpicGamesLauncher', 'Saved', 'Data', 'Manifests')
    ];
  } else if (process.platform === 'darwin') {
    return [
      '/Users/Shared/Epic Games/EpicGamesLauncher/Data/Manifests',
      path.join(os.homedir(), 'Library', 'Application Support', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests')
    ];
  } else {
    // Linux — check Heroic and Legendary
    return [
      path.join(os.homedir(), '.config', 'heroic', 'legendaryConfig', 'legendary', 'metadata'),
      path.join(os.homedir(), '.config', 'legendary', 'metadata'),
      path.join(os.homedir(), '.local', 'share', 'heroic', 'GamesConfig')
    ];
  }
}

/** Try to get a thumbnail image from the game's executable */
async function extractExeIcon(exePath) {
  try {
    // nativeImage.createThumbnailFromPath is available on Win/Mac
    // On Linux it often fails, so we catch gracefully
    const img = await nativeImage.createThumbnailFromPath(exePath, { width: 256, height: 256 });
    if (!img.isEmpty()) return img.toDataURL();
  } catch (e) { /* no icon available */ }
  return null;
}

/** Read Epic manifests and return detected games */
async function readEpicManifests() {
  const manifestDirs = getEpicManifestDirs();
  const games = [];

  for (const dir of manifestDirs) {
    try {
      await fs.access(dir);
      const files = (await fs.readdir(dir)).filter(f => f.endsWith('.item'));
      for (const file of files) {
        try {
          const raw = await fs.readFile(path.join(dir, file), 'utf8');
          const manifest = JSON.parse(raw);

          // Skip if it has no install location or it's a DLC/engine component
          if (!manifest.InstallLocation) continue;
          if (manifest.bIsIncompleteInstall) continue;
          // Skip if it looks like an engine component (no LaunchExecutable)
          if (!manifest.LaunchExecutable && !manifest.LaunchCommand) continue;

          const displayName = manifest.DisplayName || manifest.AppName || 'Unknown';
          const exeRelative = manifest.LaunchExecutable || '';
          const exeAbsolute = exeRelative
            ? path.join(manifest.InstallLocation, exeRelative)
            : manifest.InstallLocation;

          // Try to extract icon from exe
          let imageData = null;
          if (exeAbsolute && exeRelative) {
            imageData = await extractExeIcon(exeAbsolute);
          }

          games.push({
            name: displayName,
            exePath: exeAbsolute,
            installLocation: manifest.InstallLocation,
            catalogItemId: manifest.CatalogItemId || '',
            imageData: imageData || '',
            playTime: 0,
            platform: 'epic'
          });
        } catch (e) { /* skip bad manifest */ }
      }
      break; // Found a working dir, stop searching
    } catch (e) { /* try next dir */ }
  }

  // Fallback: LauncherInstalled.dat for Windows if manifests not found
  if (games.length === 0 && process.platform === 'win32') {
    try {
      const datPath = 'C:\\ProgramData\\Epic\\UnrealEngineLauncher\\LauncherInstalled.dat';
      const raw = await fs.readFile(datPath, 'utf8');
      const parsed = JSON.parse(raw);
      for (const item of (parsed.InstallationList || [])) {
        if (!item.InstallLocation) continue;
        games.push({
          name: item.DisplayName || item.AppName,
          exePath: item.InstallLocation,
          installLocation: item.InstallLocation,
          imageData: '',
          playTime: 0,
          platform: 'epic'
        });
      }
    } catch (e) { /* no Epic installed */ }
  }

  return games;
}

// ═══════════════════════════════════════════════════════
// PLAYTIME HELPERS
// ═══════════════════════════════════════════════════════

async function getPlayTime() {
  try {
    const raw = await fs.readFile(PLAYTIME_PATH, 'utf8');
    return JSON.parse(raw || '{}');
  } catch { return {}; }
}

async function updatePlayTime(gameName, additionalMinutes) {

  try {
    let times = {};
    try { times = JSON.parse(await fs.readFile(PLAYTIME_PATH, 'utf8')); } catch { }
    times[gameName] = (times[gameName] || 0) + additionalMinutes;
    await fs.writeFile(PLAYTIME_PATH, JSON.stringify(times, null, 2), 'utf8');

    // Daily log
    const today = new Date().toISOString().split('T')[0];
    let log = [];
    try { log = JSON.parse(await fs.readFile(PLAYTIME_LOG_PATH, 'utf8')); } catch { }
    log.push({ date: today, game: gameName, minutes: additionalMinutes });
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
    log = log.filter(e => e.date >= cutoff.toISOString().split('T')[0]);
    await fs.writeFile(PLAYTIME_LOG_PATH, JSON.stringify(log, null, 2), 'utf8');
    return true;
  } catch (e) { console.error("Error saving playtime:", e); return false; }
}

// ═══════════════════════════════════════════════════════
// GAME MONITOR (cross-platform)
// ═══════════════════════════════════════════════════════

function startGameMonitor(gameName, startTime, eventSender) {
  const searchTerm = gameName.split(/[ .]/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  let detected = false;
  let saving = false;

  if (rpc) {
    rpc.setActivity({
      details: `Playing ${gameName}`,
      state: 'Ludix OS Ultimate',
      startTimestamp: startTime,
      largeImageKey: 'ludix_logo',
      largeImageText: gameName,
      instance: false,
    }).catch(() => { });
  }

  const monitor = setInterval(async () => {
    if (saving) return;
    const procs = await getRunningProcesses();
    const running = procs.includes(searchTerm);

    if (running && !detected) {
      detected = true;
      console.log(`>>> [MONITOR] Detected: ${searchTerm}`);
      if (overlayWin) {
        overlayWin.webContents.send('sync-overlay-session', { gameName, startTime });
        overlayWin.showInactive();
      }
    } else if (!running && detected && !saving) {
      saving = true;
      clearInterval(monitor);
      const minutes = Math.round((Date.now() - startTime) / 60000);
      console.log(`>>> [MONITOR] Saving ${minutes}m for ${gameName}`);
      await updatePlayTime(gameName, minutes);
      if (minutes >= 1) notifySessionEnded(gameName, minutes);
      try { eventSender.send('refresh-game-list'); } catch (e) { /* window may be closed */ }
      if (rpc) rpc.clearActivity().catch(() => { });
      if (overlayWin) {
        overlayWin.webContents.send('sync-overlay-session', null);
        overlayWin.hide();
      }
    }
  }, 8000);

  return monitor;
}

// ═══════════════════════════════════════════════════════
// IPC — WINDOW CONTROLS
// ═══════════════════════════════════════════════════════

ipcMain.on('minimize-window', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('toggle-maximize-window', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w) w.isMaximized() ? w.unmaximize() : w.maximize();
});

let isProcessingClose = false;
ipcMain.on('close-window', (e) => {
  if (isProcessingClose) return;
  isProcessingClose = true;
  const w = BrowserWindow.fromWebContents(e.sender);
  if (keepInTray) {
    w.hide();
    sendProNotification('Launcher in background', 'I will continue to count your game time from here.');
    setTimeout(() => { isProcessingClose = false; }, 1000);
  } else {
    app.quit();
  }
});

ipcMain.on('show-window', () => { if (win) { win.show(); win.focus(); } });

// ═══════════════════════════════════════════════════════
// IPC — STEAM
// ═══════════════════════════════════════════════════════

ipcMain.handle('get-steam-games', async () => {
  const libraryPaths = await getSteamLibraryPaths();
  let times = {};
  try { times = JSON.parse(await fs.readFile(PLAYTIME_PATH, 'utf8')); } catch { }
  let covers = {};
  try { covers = JSON.parse(await fs.readFile(STEAM_COVERS_PATH, 'utf8')); } catch { }

  let allGames = [];
  for (const lib of libraryPaths) {
    allGames.push(...await findGamesInSteamAppsFolder(lib));
  }

  return allGames
    .map(g => ({ ...g, playTime: times[g.name] || 0, imageData: covers[g.id] || '', platform: 'steam' }))
    .filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i);
});

// ═══════════════════════════════════════════════════════
// IPC — EPIC GAMES (auto-detect only, stored separately)
// ═══════════════════════════════════════════════════════

ipcMain.handle('get-epic-games', async () => {
  let games = [];
  try { games = JSON.parse(await fs.readFile(EPIC_GAMES_PATH, 'utf8')); } catch { }
  let times = {};
  try { times = JSON.parse(await fs.readFile(PLAYTIME_PATH, 'utf8')); } catch { }
  return games.map(g => ({ ...g, playTime: times[g.name] || 0 }));
});

ipcMain.handle('add-epic-game', async (event, game) => {
  let games = [];
  try { games = JSON.parse(await fs.readFile(EPIC_GAMES_PATH, 'utf8')); } catch { }
  if (games.find(g => g.name === game.name)) return { success: false, error: 'Game already exists' };
  games.push({ name: game.name || 'Unnamed', exePath: game.exePath || '', imageData: game.imageData || '', playTime: 0 });
  await fs.writeFile(EPIC_GAMES_PATH, JSON.stringify(games, null, 2), 'utf8');
  return { success: true };
});

ipcMain.handle('delete-epic-game', async (event, gameName) => {
  try {
    let games = JSON.parse(await fs.readFile(EPIC_GAMES_PATH, 'utf8'));
    await fs.writeFile(EPIC_GAMES_PATH, JSON.stringify(games.filter(g => g.name !== gameName), null, 2));
    return { success: true };
  } catch (e) { return { success: false }; }
});

ipcMain.handle('update-epic-game', async (event, { oldName, updatedGame }) => {
  try {
    let games = JSON.parse(await fs.readFile(EPIC_GAMES_PATH, 'utf8'));
    const idx = games.findIndex(g => g.name === oldName);
    if (idx !== -1) {
      updatedGame.playTime = games[idx].playTime || 0;
      games[idx] = updatedGame;
      await fs.writeFile(EPIC_GAMES_PATH, JSON.stringify(games, null, 2));
      return { success: true };
    }
    return { success: false, error: 'Not found' };
  } catch (e) { return { success: false, error: e.message }; }
});

// AUTO-DETECT: reads .item manifests for proper display names + icons
ipcMain.handle('auto-detect-epic-games', async () => {
  try {
    const detected = await readEpicManifests();

    let saved = [];
    try { saved = JSON.parse(await fs.readFile(EPIC_GAMES_PATH, 'utf8')); } catch { }
    const savedNames = new Set(saved.map(g => g.name));

    const newGames = detected.filter(g => g.name && !savedNames.has(g.name));
    return { success: true, games: newGames };
  } catch (err) {
    console.error('Auto-detect error:', err.message);
    return { success: false, games: [], error: err.message };
  }
});

// ═══════════════════════════════════════════════════════
// IPC — OTHER GAMES (manual, any platform)
// ═══════════════════════════════════════════════════════

ipcMain.handle('get-other-games', async () => {
  let games = [];
  try { games = JSON.parse(await fs.readFile(OTHER_GAMES_PATH, 'utf8')); } catch { }
  let times = {};
  try { times = JSON.parse(await fs.readFile(PLAYTIME_PATH, 'utf8')); } catch { }
  return games.map(g => ({ ...g, playTime: times[g.name] || 0 }));
});

ipcMain.handle('add-other-game', async (event, game) => {
  let games = [];
  try { games = JSON.parse(await fs.readFile(OTHER_GAMES_PATH, 'utf8')); } catch { }
  if (games.find(g => g.name === game.name)) return { success: false, error: 'Game already exists' };
  games.push({ name: game.name || 'Unnamed', exePath: game.exePath || '', imageData: game.imageData || '', playTime: 0 });
  await fs.writeFile(OTHER_GAMES_PATH, JSON.stringify(games, null, 2), 'utf8');
  return { success: true };
});

ipcMain.handle('delete-other-game', async (event, gameName) => {
  try {
    let games = JSON.parse(await fs.readFile(OTHER_GAMES_PATH, 'utf8'));
    await fs.writeFile(OTHER_GAMES_PATH, JSON.stringify(games.filter(g => g.name !== gameName), null, 2));
    return { success: true };
  } catch (e) { return { success: false }; }
});

ipcMain.handle('update-other-game', async (event, { oldName, updatedGame }) => {
  try {
    let games = JSON.parse(await fs.readFile(OTHER_GAMES_PATH, 'utf8'));
    const idx = games.findIndex(g => g.name === oldName);
    if (idx !== -1) {
      updatedGame.playTime = games[idx].playTime || 0;
      games[idx] = updatedGame;
      await fs.writeFile(OTHER_GAMES_PATH, JSON.stringify(games, null, 2));
      return { success: true };
    }
    return { success: false, error: 'Not found' };
  } catch (e) { return { success: false, error: e.message }; }
});

// ═══════════════════════════════════════════════════════
// IPC — RETRO GAMES LIST
// ═══════════════════════════════════════════════════════

ipcMain.handle('get-retro-games', async () => {
  try {
    const pt = await getPlayTime();
    ensureDataFiles();
    const data = await fs.readFile(RETRO_GAMES_PATH, 'utf-8');
    const games = JSON.parse(data || '[]');
    return games.map(g => ({ ...g, playTime: pt[g.name] || 0 }));
  } catch (e) { return []; }
});

ipcMain.handle('add-retro-game', async (event, gameParams) => {
  try {
    ensureDataFiles();
    const data = await fs.readFile(RETRO_GAMES_PATH, 'utf-8');
    const games = JSON.parse(data || '[]');
    games.push(gameParams);
    await fs.writeFile(RETRO_GAMES_PATH, JSON.stringify(games, null, 2));
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('delete-retro-game', async (event, gameName) => {
  try {
    ensureDataFiles();
    const data = await fs.readFile(RETRO_GAMES_PATH, 'utf-8');
    let games = JSON.parse(data || '[]');
    games = games.filter(g => g.name !== gameName);
    await fs.writeFile(RETRO_GAMES_PATH, JSON.stringify(games, null, 2));
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('update-retro-game', async (event, gameId, updatedData) => {
  try {
    ensureDataFiles();
    const data = await fs.readFile(RETRO_GAMES_PATH, 'utf-8');
    let games = JSON.parse(data || '[]');
    const idx = games.findIndex(g => g.name === gameId);
    if (idx !== -1) {
      games[idx] = { ...games[idx], ...updatedData };
      await fs.writeFile(RETRO_GAMES_PATH, JSON.stringify(games, null, 2));
      return { success: true };
    }
    return { success: false, error: 'Not found' };
  } catch (e) { return { success: false, error: e.message }; }
});

/** Scan common game directories to suggest executables */
ipcMain.handle('suggest-executables', async () => {
  const candidates = [];

  // Common game directories per platform
  let searchDirs = [];
  if (process.platform === 'win32') {
    searchDirs = [
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      'D:\\Games',
      'D:\\Program Files',
      'E:\\Games',
      path.join(os.homedir(), 'AppData', 'Roaming')
    ];
    // Also add Steam library paths
    try {
      const steamPaths = await getSteamLibraryPaths();
      for (const sp of steamPaths) searchDirs.push(path.join(sp, '..', 'common'));
    } catch { }
  } else if (process.platform === 'darwin') {
    searchDirs = ['/Applications', path.join(os.homedir(), 'Applications')];
  } else {
    searchDirs = [
      '/usr/games',
      '/usr/local/games',
      path.join(os.homedir(), 'Games'),
      path.join(os.homedir(), '.local', 'share', 'applications')
    ];
  }

  const ext = process.platform === 'win32' ? '.exe' : (process.platform === 'darwin' ? '.app' : '');

  for (const dir of searchDirs) {
    const walkDir = async (currentDir, maxDepth, currentDepth = 0) => {
      if (currentDepth > maxDepth || candidates.length >= 2000) return;
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          try {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
              const skip = ['windows', 'system32', 'common files', 'windowsapps', 'uninstall', 'redist'];
              if (skip.includes(entry.name.toLowerCase())) continue;
              await walkDir(fullPath, maxDepth, currentDepth + 1);
            } else if (ext ? entry.name.endsWith(ext) : (!entry.name.includes('.') || entry.name.endsWith('.sh'))) {
              let gameName = entry.name.replace(/\.(exe|app|sh)$/i, '');
              const generic = ['launcher', 'application', 'game', 'start', 'shipping', 'win64', 'binaries', 'play', 'client'];
              if (generic.includes(gameName.toLowerCase())) {
                gameName = path.basename(currentDir);
                if (generic.includes(gameName.toLowerCase()) || gameName.length <= 2) {
                  gameName = path.basename(path.dirname(currentDir));
                }
              }
              candidates.push({ name: gameName, exePath: fullPath });
            }
          } catch { }
        }
      } catch { }
    };
    await walkDir(dir, 5);
  }

  // Deduplicate and limit
  const seen = new Set();
  return candidates
    .filter(c => { if (seen.has(c.exePath)) return false; seen.add(c.exePath); return true; })
    .slice(0, 300);
});

// ═══════════════════════════════════════════════════════
// IPC — GAME LAUNCH (cross-platform)
// ═══════════════════════════════════════════════════════

ipcMain.handle('launch-game', async (event, exePath, gameName, isEpicPlatform = false) => {
  if (!exePath) return { success: false, error: 'Missing path' };

  event.sender.send('update-last-game', gameName);
  const startTime = Date.now();

  // Steam protocol URL
  const isSteamProtocol = exePath.startsWith('steam://');
  if (isSteamProtocol) {
    const idMatch = exePath.match(/(\d+)$/);
    if (idMatch) launchSteamGame(idMatch[1]);
  } else {
    try {
      // Special handling for Linux Epic games
      if (process.platform === 'linux' && isEpicPlatform) {
        // Try heroic URI first, fallback to wine
        const sanitizedAppName = gameName.replace(/[^a-zA-Z0-9]/g, '');
        const heroicChild = require('child_process').spawn('xdg-open', [`heroic://launch/legendary/${sanitizedAppName}`], { detached: true, stdio: 'ignore' });
        heroicChild.unref();
      } else {
        let child;
        if (exePath.includes('|||')) {

          const [emu, rom] = exePath.split('|||');
          child = require('child_process').spawn(emu, [rom], { detached: true, stdio: 'ignore', cwd: require('path').dirname(emu) });
        } else {
          child = require('child_process').spawn(exePath, [], { detached: true, stdio: 'ignore', cwd: require('path').dirname(exePath) });
        }
        child.unref();
      }
    } catch (e) {
      console.error('Launch error:', e);
      return { success: false, error: e.message };
    }
  }

  startGameMonitor(gameName, startTime, event.sender);
  return { success: true };
});

ipcMain.handle('launch-epic-game', async (event, exePath, gameName) => {
  return ipcMain.emit ? ipcMain.invoke('launch-game', event, exePath, gameName, true) : { success: false };
});

// ═══════════════════════════════════════════════════════
// IPC — SYSTEM
// ═══════════════════════════════════════════════════════

ipcMain.handle('show-open-dialog', async (event, options) => dialog.showOpenDialog(options));

ipcMain.handle('select-custom-cover', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'webp', 'jpeg', 'gif'] }]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const data = await fs.readFile(result.filePaths[0], 'base64');
      const ext = path.extname(result.filePaths[0]).replace('.', '').toLowerCase() || 'png';
      return { success: true, data: `data:image/${ext};base64,${data}` };
    } catch { return { success: false }; }
  }
  return { success: false };
});

ipcMain.handle('save-steam-custom-cover', async (e, id, data) => {
  let covers = {};
  try { covers = JSON.parse(await fs.readFile(STEAM_COVERS_PATH, 'utf8')); } catch { }
  covers[id] = data;
  await fs.writeFile(STEAM_COVERS_PATH, JSON.stringify(covers), 'utf8');
  return true;
});

ipcMain.handle('save-image', async (event, sourcePath, name) => {
  try {
    if (!sourcePath || !name) return { success: false, error: 'Invalid path or name' };
    const imagesDir = path.join(app.getPath('userData'), 'epic-images');
    await fs.mkdir(imagesDir, { recursive: true });
    const ext = path.extname(sourcePath).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) return { success: false, error: 'Unsupported format' };
    const destPath = path.join(imagesDir, `${name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}${ext}`);
    await fs.copyFile(sourcePath, destPath);
    return { success: true, path: destPath };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('get-ram-usage', async () => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    usedGB: (used / 1024 / 1024 / 1024).toFixed(1),
    totalGB: (total / 1024 / 1024 / 1024).toFixed(1)
  };
});

ipcMain.handle('get-gaming-news', async () => {
  const now = Date.now();
  if (cachedNews && (now - lastNewsFetch < 15 * 60 * 1000)) return cachedNews;

  try {
    // GameSpot usually has more stable RSS feeds than IGN
    const feed = await rssParser.parseURL('https://www.gamespot.com/feeds/news/');
    cachedNews = feed.items.slice(0, 5).map(item => ({
      title: item.title,
      link: item.link,
      date: item.pubDate,
      contentSnippet: item.contentSnippet
    }));
    lastNewsFetch = now;
    return cachedNews;
  } catch (error) {
    console.error('RSS Error:', error);
    // Silent fallback to IGN all if GameSpot fails
    try {
      const fallback = await rssParser.parseURL('https://www.ign.com/rss/all');
      return fallback.items.slice(0, 5).map(item => ({
        title: item.title,
        link: item.link,
        date: item.pubDate,
        contentSnippet: item.contentSnippet
      }));
    } catch (e) { return []; }
  }
});

ipcMain.handle('open-external', async (_, url) => {
  return await shell.openExternal(url);
});

ipcMain.handle('reset-all-times', async () => {
  try { await fs.writeFile(PLAYTIME_PATH, JSON.stringify({}, null, 2), 'utf8'); return true; }
  catch (e) { return false; }
});

// ═══════════════════════════════════════════════════════
// IPC — AUTO-LAUNCH + WEEKLY REPORT
// ═══════════════════════════════════════════════════════

ipcMain.handle('get-auto-launch', () => app.getLoginItemSettings().openAtLogin);

ipcMain.handle('set-auto-launch', (event, enabled) => {
  app.setLoginItemSettings(enabled
    ? { openAtLogin: true, args: ['--hidden'] }
    : { openAtLogin: false }
  );
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('get-weekly-report', async () => {
  try {
    let log = [];
    try { log = JSON.parse(await fs.readFile(PLAYTIME_LOG_PATH, 'utf8')); } catch { }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const weekEntries = log.filter(e => e.date >= cutoffStr);

    const byGame = {};
    for (const entry of weekEntries) byGame[entry.game] = (byGame[entry.game] || 0) + entry.minutes;

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const totalMins = weekEntries.filter(e => e.date === dateStr).reduce((acc, e) => acc + e.minutes, 0);
      days.push({ date: dateStr, minutes: totalMins });
    }

    const games = Object.entries(byGame).map(([name, minutes]) => ({ name, minutes })).sort((a, b) => b.minutes - a.minutes);
    return { success: true, games, days, totalMinutes: games.reduce((a, g) => a + g.minutes, 0) };
  } catch (e) {
    return { success: false, games: [], days: [], totalMinutes: 0 };
  }
});

// ═══════════════════════════════════════════════════════
// WINDOW + APP LIFECYCLE
// ═══════════════════════════════════════════════════════

let win;
let overlayWin;

function createOverlay() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  overlayWin = new BrowserWindow({
    width: 320,
    height: 140,
    x: width - 340,
    y: 40,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    show: false,
    resizable: false,
    focusable: false, // Prevents it from stealing focus or being hidden by some games
    skipTaskbar: true, // cleaner look
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  overlayWin.setAlwaysOnTop(true, 'screen-saver', 1);
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  overlayWin.loadFile('overlay.html');
}

function createWindow() {
  if (win) return;
  win = new BrowserWindow({
    width: 1100, height: 720,
    frame: false,
    backgroundColor: '#0f0f12',
    icon: path.join(__dirname, 'build/logo.png'),
    webPreferences: { contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
  });
  win.loadFile('index.html');
  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
      sendProNotification('Launcher in background', 'I will continue to count your game time from here.');
    }
  });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); if (!win.isVisible()) win.show(); win.focus(); }
  });

  app.whenReady().then(() => {
    createTray();
    createOverlay();

    globalShortcut.register('CommandOrControl+Shift+O', () => {
      if (overlayWin) {
        if (overlayWin.isVisible()) {
          overlayWin.hide();
        } else {
          overlayWin.showInactive();
        }
      }
    });

    if (!process.argv.includes('--hidden')) createWindow();
    else console.log("Starting in background mode...");
  });
}

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});