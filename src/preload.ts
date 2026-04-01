import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  selectImages: () => Promise<{ filePaths: string[]; fileData: Array<{ name: string; data: string }> } | null>;
  saveFile: (defaultName: string, content: string) => Promise<string | null>;
  saveJsonResponse: (filename: string, json: string) => Promise<string | null>;
}

contextBridge.exposeInMainWorld('electronAPI', {
  selectImages: () => ipcRenderer.invoke('dialog:selectImages'),
  saveFile: (defaultName: string, content: string) =>
    ipcRenderer.invoke('dialog:saveFile', defaultName, content),
  saveJsonResponse: (filename: string, json: string) =>
    ipcRenderer.invoke('file:saveJson', filename, json),
} as ElectronAPI);
