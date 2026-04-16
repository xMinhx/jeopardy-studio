// Preload: expose a safe, typed API surface if needed
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getState: async () => ipcRenderer.invoke('state:get'),
  updateState: (state) => ipcRenderer.send('state:update', state),
  onStateChanged: (cb) => {
    const handler = (_e, state) => cb(state);
    ipcRenderer.on('state:changed', handler);
    return () => ipcRenderer.removeListener('state:changed', handler);
  },
  showTimer: () => ipcRenderer.send('display:mode', 'timer'),
  showScoreboard: () => ipcRenderer.send('display:mode', 'scoreboard'),
  getDisplayMode: async () => ipcRenderer.invoke('display:get'),
  onDisplayMode: (cb) => {
    const handler = (_e, mode) => cb(mode);
    ipcRenderer.on('display:mode', handler);
    return () => ipcRenderer.removeListener('display:mode', handler);
  },
  onTimerTick: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('timer:tick', handler);
    return () => ipcRenderer.removeListener('timer:tick', handler);
  },
  sendTimerTick: (remainingMs, durationMs, running, ended = false, displayMs) =>
    ipcRenderer.send('timer:tick', { remainingMs, durationMs, running, ended, displayMs }),
});
