const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const SimpleStore = require('./simple-store');
const { TallyConnector } = require('./tally-connector');
const { makeSquarePNG } = require('./make-icon');

const store = new SimpleStore({
  dir: app.getPath('userData'),
  defaults: {
    tallyHost: '127.0.0.1',
    tallyPort: 9000,
    syncMode: 'direct', // 'direct' (same PC/LAN, or an IP the cloud provider whitelisted) | 'folder' (Tally-on-Cloud via synced folder)
    folderPath: '',
    pollIntervalSec: 30,
    companyName: '',
    startMinimized: false,
  },
});

let mainWindow = null;
let tray = null;
let pollTimer = null;
let isQuitting = false;

const connector = new TallyConnector({
  host: store.get('tallyHost'),
  port: store.get('tallyPort'),
  mode: store.get('syncMode'),
  folderPath: store.get('folderPath'),
});

let lastStatus = { ok: false, error: 'Not synced yet', companies: [], lastSyncedAt: null };
let lastTrialBalance = null;

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    title: 'Tally Desk — Aggarwal Abhishek & Co.',
    icon: fs.existsSync(iconPath) ? iconPath : nativeImage.createFromBuffer(makeSquarePNG(256)),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
    show: !store.get('startMinimized'),
  });

  mainWindow.loadFile(path.join(__dirname, 'shell.html'));

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  // Prefer a real brand icon if one has been dropped into build/, otherwise
  // fall back to a small generated placeholder so the tray icon is never
  // empty (an empty image can throw on Windows/Linux tray creation).
  const iconPath = path.join(__dirname, '..', 'build', 'tray-icon.png');
  let img = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  if (img.isEmpty()) {
    img = nativeImage.createFromBuffer(makeSquarePNG(32));
  }
  tray = new Tray(img);
  tray.setToolTip('Tally Desk — background sync running');
  updateTrayMenu();
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;
  const statusLabel = lastStatus.ok
    ? `Connected — last synced ${lastStatus.lastSyncedAt ? new Date(lastStatus.lastSyncedAt).toLocaleTimeString() : 'now'}`
    : `Not connected${lastStatus.error ? ' — ' + lastStatus.error : ''}`;
  const menu = Menu.buildFromTemplate([
    { label: statusLabel, enabled: false },
    { type: 'separator' },
    { label: 'Open Tally Desk', click: () => mainWindow && mainWindow.show() },
    { label: 'Sync now', click: () => pollTally(true) },
    { type: 'separator' },
    {
      label: 'Quit Tally Desk',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

async function pollTally(force = false) {
  const result = await connector.ping();
  lastStatus = { ...result, lastSyncedAt: Date.now() };

  if (result.ok) {
    const companyName = store.get('companyName') || result.companies[0] || '';
    if (companyName) {
      try {
        const today = new Date();
        const fy = fiscalYearBounds(today);
        lastTrialBalance = await connector.fetchTrialBalance(companyName, fy.from, fy.to);
      } catch (err) {
        lastStatus = { ok: true, companies: result.companies, error: `Connected, but couldn't read Trial Balance: ${err.message}`, lastSyncedAt: Date.now() };
      }
    }
  }

  updateTrayMenu();
  if (mainWindow) {
    mainWindow.webContents.send('tally:status', lastStatus);
    if (lastTrialBalance) mainWindow.webContents.send('tally:trial-balance', lastTrialBalance);
  }
}

function fiscalYearBounds(d) {
  // Indian FY: 1 Apr – 31 Mar
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const pad = (n) => String(n).padStart(2, '0');
  return { from: `${y}0401`, to: `${y + 1}0331` };
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  const sec = Math.max(10, store.get('pollIntervalSec') || 30);
  pollTimer = setInterval(() => pollTally(false), sec * 1000);
  pollTally(false);
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  startPolling();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  // Keep running in the tray — this is a background-sync app by design.
});

app.on('before-quit', () => {
  isQuitting = true;
});

// ---- IPC ---------------------------------------------------------------

ipcMain.handle('tally:get-settings', () => ({
  tallyHost: store.get('tallyHost'),
  tallyPort: store.get('tallyPort'),
  syncMode: store.get('syncMode'),
  folderPath: store.get('folderPath'),
  pollIntervalSec: store.get('pollIntervalSec'),
  companyName: store.get('companyName'),
}));

ipcMain.handle('tally:set-settings', (evt, settings) => {
  if (settings.tallyHost) store.set('tallyHost', settings.tallyHost);
  if (settings.tallyPort) store.set('tallyPort', Number(settings.tallyPort));
  if (settings.syncMode) store.set('syncMode', settings.syncMode);
  if (typeof settings.folderPath === 'string') store.set('folderPath', settings.folderPath);
  if (settings.pollIntervalSec) store.set('pollIntervalSec', Number(settings.pollIntervalSec));
  if (typeof settings.companyName === 'string') store.set('companyName', settings.companyName);
  connector.configure({
    host: store.get('tallyHost'),
    port: store.get('tallyPort'),
    mode: store.get('syncMode'),
    folderPath: store.get('folderPath'),
  });
  startPolling();
  return true;
});

ipcMain.handle('tally:pick-folder', async () => {
  const { dialog } = require('electron');
  const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

ipcMain.handle('tally:sync-now', async () => {
  await pollTally(true);
  return { status: lastStatus, trialBalance: lastTrialBalance };
});

ipcMain.handle('tally:get-last', () => ({ status: lastStatus, trialBalance: lastTrialBalance }));
