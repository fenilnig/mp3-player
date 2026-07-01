const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getLibraryFiles: () => ipcRenderer.invoke('get-library-files'),
    getAmbientFiles: () => ipcRenderer.invoke('get-ambient-files'),
    getScenes: () => ipcRenderer.invoke('get-scenes'),
    saveScenes: (data) => ipcRenderer.invoke('save-scenes', data),
    getAnalytics: () => ipcRenderer.invoke('get-analytics'),
    saveAnalytics: (data) => ipcRenderer.invoke('save-analytics', data),
    getTrackMetadata: (filePath) => ipcRenderer.invoke('get-track-metadata', filePath),
    getAchievements: () => ipcRenderer.invoke('get-achievements'),
    saveAchievements: (data) => ipcRenderer.invoke('save-achievements', data),
    getDaily: () => ipcRenderer.invoke('get-daily'),
    saveDaily: (data) => ipcRenderer.invoke('save-daily', data),
    onCloseAnimation: (callback) => ipcRenderer.on('trigger-close', callback),
    scanLibrary: () => ipcRenderer.invoke('scan-library'),
    getLibraryIndex: () => ipcRenderer.invoke('get-library-index'),
    onScanProgress: (callback) => ipcRenderer.on('library-scan-progress', (e, data) => callback(data)),
    getAudioLabData: () => ipcRenderer.invoke('get-audiolab'),
    saveAudioLabData: (data) => ipcRenderer.invoke('save-audiolab', data)
});
