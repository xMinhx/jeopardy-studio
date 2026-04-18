// Electron main process
'use strict';

const { app, BrowserWindow, ipcMain, protocol, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !!process.env.VITE_DEV_SERVER_URL;
const rendererDistPath = path.normalize(path.join(__dirname, '../../dist/renderer'));

/** @type {string} */
const iconPath = app.isPackaged
  ? path.join(__dirname, '../../dist/renderer/assets/icon.ico')
  : path.join(__dirname, '../../public/assets/icon.ico');

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

/** @type {BrowserWindow | null} */
let controlWindow = null;
/** @type {BrowserWindow | null} */
let displayWindow = null;
/** In-memory snapshot of the latest board+team state (shared across windows). */
let latestState = null;
/** Current display mode: 'scoreboard' | 'timer'. */
let displayMode = 'scoreboard';

function registerRendererProtocol() {
  protocol.registerFileProtocol('app', (request, callback) => {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
      const decodedPath = decodeURIComponent(pathname);
      const fullPath = path.normalize(path.join(rendererDistPath, decodedPath));
      // Guard against path traversal attacks
      if (!fullPath.startsWith(rendererDistPath)) {
        throw new Error('Attempted to access file outside renderer dist');
      }
      callback({ path: fullPath });
    } catch (error) {
      console.error('Failed to resolve app:// protocol path', error);
      callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
    }
  });
}

function createWindows() {
  const { Menu } = require('electron');
  Menu.setApplicationMenu(null);

  const sharedPreferences = {
    preload: path.join(__dirname, '../preload/index.cjs'),
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
  };

  controlWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Jeopardy',
    icon: iconPath,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',
      symbolColor: '#0f172a'
    },
    webPreferences: sharedPreferences,
  });

  displayWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    title: 'Jeopardy',
    icon: iconPath,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',
      symbolColor: '#0f172a'
    },
    webPreferences: sharedPreferences,
  });

  if (isDev) {
    const base = process.env.VITE_DEV_SERVER_URL;
    controlWindow.loadURL(`${base}?view=control`);
    displayWindow.loadURL(`${base}?view=display`);
  } else {
    controlWindow.loadURL('app://index.html?view=control');
    displayWindow.loadURL('app://index.html?view=display');
  }
}

function registerIpcHandlers() {
  // ── State sync ─────────────────────────────────────────────────────────────
  ipcMain.handle('state:get', () => latestState);

  ipcMain.on('state:update', (_e, state) => {
    latestState = state;
    // Broadcast to all renderer processes so Display stays in sync
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents.send('state:changed', latestState);
    }
  });

  // ── Display mode ───────────────────────────────────────────────────────────
  ipcMain.handle('display:get', () => displayMode);

  ipcMain.on('display:mode', (_e, mode) => {
    displayMode = mode;
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents.send('display:mode', displayMode);
    }
  });

  // ── Timer ticks ────────────────────────────────────────────────────────────
  ipcMain.on('timer:tick', (_e, payload) => {
    if (!displayWindow) return;
    displayWindow.webContents.send('timer:tick', payload);
  });

  // ── File I/O ──────────────────────────────────────────────────────────────
  ipcMain.handle('file:open', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(controlWindow, {
      title: 'Import Board JSON',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return null;
    const content = fs.readFileSync(filePaths[0], 'utf-8');
    return JSON.parse(content);
  });

  ipcMain.handle('file:save', async (_e, data) => {
    const { canceled, filePath } = await dialog.showSaveDialog(controlWindow, {
      title: 'Export Board JSON',
      defaultPath: 'my-jeopardy-board.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return false;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  if (!isDev) registerRendererProtocol();
  createWindows();
  registerIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindows();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
