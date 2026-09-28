const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tallyDesk', {
  getSettings: () => ipcRenderer.invoke('tally:get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('tally:set-settings', settings),
  syncNow: () => ipcRenderer.invoke('tally:sync-now'),
  getLast: () => ipcRenderer.invoke('tally:get-last'),
  pickFolder: () => ipcRenderer.invoke('tally:pick-folder'),
  onStatus: (cb) => ipcRenderer.on('tally:status', (evt, data) => cb(data)),
  onTrialBalance: (cb) => ipcRenderer.on('tally:trial-balance', (evt, data) => cb(data)),
});
