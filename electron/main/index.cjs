// Electron main process
const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');

const isDev = !!process.env.VITE_DEV_SERVER_URL;
const rendererDistPath = path.normalize(path.join(__dirname, '../../dist/renderer'));

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let controlWindow = null;
let displayWindow = null;
let latestState = null; // persisted in-memory snapshot
let displayMode = 'scoreboard'; // 'scoreboard' | 'timer'
const iconPath = app.isPackaged
  ? path.join(__dirname, '../../dist/renderer/assets/icon.ico')
  : path.join(__dirname, '../../public/assets/icon.ico');

function registerRendererProtocol() {
  protocol.registerFileProtocol('app', (request, callback) => {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
      const decodedPath = decodeURIComponent(pathname);
      const fullPath = path.normalize(path.join(rendererDistPath, decodedPath));
      if (!fullPath.startsWith(rendererDistPath)) {
        throw new Error('Attempted to access file outside renderer dist');
      }
      callback({ path: fullPath });
    } catch (error) {
      console.error('Failed to resolve app:// protocol path', error);
      callback({ error });
    }
  });
}

function createWindows() {
  controlWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Jeopardy Helper — Control',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  displayWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    title: 'Jeopardy Helper — Display',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    const base = process.env.VITE_DEV_SERVER_URL;
    controlWindow.loadURL(`${base}?view=control`);
    displayWindow.loadURL(`${base}?view=display`);
  } else {
    const appUrl = 'app://index.html';
    controlWindow.loadURL(`${appUrl}?view=control`);
    displayWindow.loadURL(`${appUrl}?view=display`);
  }
}

app.whenReady().then(() => {
  if (!isDev) registerRendererProtocol();
  createWindows();

  // IPC: state request/update
  ipcMain.handle('state:get', () => latestState);
  ipcMain.handle('display:get', () => displayMode);
  ipcMain.on('state:update', (_e, state) => {
    latestState = state;
    // Broadcast to all renderer processes
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents.send('state:changed', latestState);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindows();
  });
});

// Display mode control
ipcMain.on('display:mode', (_e, mode) => {
  displayMode = mode;
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('display:mode', displayMode);
  }
});

// Timer ticks to Display
ipcMain.on('timer:tick', (_e, payload) => {
  if (!displayWindow) return;
  displayWindow.webContents.send('timer:tick', payload);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
