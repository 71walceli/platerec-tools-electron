import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = (): void => {
  // Set CSP to allow blob: URLs for images, connect to any API endpoint,
  // and allow inline styles (needed by MUI).
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:",
            "connect-src 'self' https: http: ws: wss:",
            "img-src 'self' data: blob: https: http:",
            "font-src 'self' data: https:",
            "style-src 'self' 'unsafe-inline' https:",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          ].join('; '),
        ],
      },
    });
  });

  const mainWindow = new BrowserWindow({
    height: 900,
    width: 1400,
    minWidth: 1000,
    minHeight: 700,
    title: 'PlateRecognizer Snapshot API Tester',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
};

// IPC Handlers
ipcMain.handle('dialog:selectImages', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const fileData = result.filePaths.map((filePath) => {
    const data = fs.readFileSync(filePath);
    return {
      name: path.basename(filePath),
      data: `data:image/${path.extname(filePath).slice(1)};base64,${data.toString('base64')}`,
    };
  });

  return { filePaths: result.filePaths, fileData };
});

ipcMain.handle('dialog:saveFile', async (_event, defaultName: string, content: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  fs.writeFileSync(result.filePath, content, 'utf-8');
  return result.filePath;
});

ipcMain.handle('file:saveJson', async (_event, filename: string, json: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath: filename,
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  fs.writeFileSync(result.filePath, json, 'utf-8');
  return result.filePath;
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
