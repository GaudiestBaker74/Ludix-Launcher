// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Steam
  getSteamGames: () => ipcRenderer.invoke('get-steam-games'),
  
  // Epic
  getEpicGames: () => ipcRenderer.invoke('get-epic-games'),
  addEpicGame: (game) => ipcRenderer.invoke('add-epic-game', game),
  saveImage: (sourcePath, name) => ipcRenderer.invoke('save-image', sourcePath, name),
  removeEpicGame: (name) => ipcRenderer.invoke('remove-epic-game', name),
  launchEpicGame: (exePath, gameName) => ipcRenderer.invoke('launch-epic-game', exePath, gameName),
  deleteEpicGame: (gameName) => ipcRenderer.invoke('delete-epic-game', gameName),
  getRamUsage: () => ipcRenderer.invoke('get-ram-usage'),
  onUpdateLastGame: (callback) => ipcRenderer.on('update-last-game', (event, name) => callback(name)),
  onRefreshEpicList: (callback) => ipcRenderer.on('refresh-epic-list', () => callback()),
  launchGame: (exePath, gameName) => ipcRenderer.invoke('launch-game', exePath, gameName),
  onRefreshGameList: (callback) => ipcRenderer.on('refresh-game-list', () => callback()),
  resetAllPlayTimes: () => ipcRenderer.invoke('reset-all-times'),

  // Diálogos
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  
  // Ventana
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  toggleMaximizeWindow: () => ipcRenderer.send('toggle-maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window')
});