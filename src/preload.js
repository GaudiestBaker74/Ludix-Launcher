// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Steam
  getSteamGames: () => ipcRenderer.invoke('get-steam-games'),
  saveSteamCustomCover: (id, data) => ipcRenderer.invoke('save-steam-custom-cover', id, data),

  // Epic (auto-detect only)
  getEpicGames: () => ipcRenderer.invoke('get-epic-games'),
  addEpicGame: (game) => ipcRenderer.invoke('add-epic-game', game),
  deleteEpicGame: (name) => ipcRenderer.invoke('delete-epic-game', name),
  updateEpicGame: (oldName, updated) => ipcRenderer.invoke('update-epic-game', { oldName, updatedGame: updated }),
  autoDetectEpicGames: () => ipcRenderer.invoke('auto-detect-epic-games'),

  // Other Games (manual)
  getOtherGames: () => ipcRenderer.invoke('get-other-games'),
  addOtherGame: (game) => ipcRenderer.invoke('add-other-game', game),
  deleteOtherGame: (name) => ipcRenderer.invoke('delete-other-game', name),
  updateOtherGame: (oldName, updated) => ipcRenderer.invoke('update-other-game', { oldName, updatedGame: updated }),
  suggestExecutables: () => ipcRenderer.invoke('suggest-executables'),

  // Retro
  getRetroGames: () => ipcRenderer.invoke('get-retro-games'),
  addRetroGame: (game) => ipcRenderer.invoke('add-retro-game', game),
  deleteRetroGame: (name) => ipcRenderer.invoke('delete-retro-game', name),
  updateRetroGame: (oldName, updated) => ipcRenderer.invoke('update-retro-game', { oldName, updatedGame: updated }),

  // RSS News
  getGamingNews: () => ipcRenderer.invoke('get-gaming-news'),

  // System
  getRamUsage: () => ipcRenderer.invoke('get-ram-usage'),
  resetAllPlayTimes: () => ipcRenderer.invoke('reset-all-times'),
  saveImage: (src, name) => ipcRenderer.invoke('save-image', src, name),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Auto-launch
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (en) => ipcRenderer.invoke('set-auto-launch', en),

  // Weekly report
  getWeeklyReport: () => ipcRenderer.invoke('get-weekly-report'),

  // Game launch
  launchGame: (exe, name) => ipcRenderer.invoke('launch-game', exe, name),

  // Dialogs
  showOpenDialog: (opts) => ipcRenderer.invoke('show-open-dialog', opts),
  selectCustomCover: () => ipcRenderer.invoke('select-custom-cover'),

  // IPC events (main → renderer)
  onSyncOverlaySession: (cb) => ipcRenderer.on('sync-overlay-session', (_, data) => cb(data)),
  onUpdateLastGame: (cb) => ipcRenderer.on('update-last-game', (_, name) => cb(name)),
  onRefreshGameList: (cb) => ipcRenderer.on('refresh-game-list', () => cb()),
  onClearTerminal: (cb) => ipcRenderer.on('clear-terminal', () => cb()),

  // Window
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  toggleMaximizeWindow: () => ipcRenderer.send('toggle-maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  showWindow: () => ipcRenderer.send('show-window'),
});