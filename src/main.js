const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function hashString(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}

let isQuiting = false;

const basePath = app.isPackaged ? path.join(process.resourcesPath, '..') : path.join(__dirname, '..');

function createWindow() {
    const win = new BrowserWindow({
        width: 1100,
        height: 750,
        icon: path.join(__dirname, 'assets', 'icon_transparent.png'),
        backgroundColor: '#0a0a0a',
        titleBarStyle: 'hidden',
        titleBarOverlay: { color: 'rgba(0,0,0,0)', symbolColor: '#a0b4ff' },
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false 
        }
    });
    win.setMenuBarVisibility(false);
    
    win.on('close', (e) => {
        if (!isQuiting) {
            e.preventDefault();
            win.webContents.send('trigger-close');
            let op = 1;
            const fadeInterval = setInterval(() => {
                op -= 0.05;
                if (op <= 0) {
                    clearInterval(fadeInterval);
                    isQuiting = true;
                    app.quit();
                } else {
                    win.setOpacity(op);
                }
            }, 15);
        }
    });
    
    win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// File Readers
ipcMain.handle('get-library-files', async () => {
    const p = path.join(basePath, 'library');
    if (!fs.existsSync(p)) fs.mkdirSync(p);
    try {
        const files = fs.readdirSync(p);
        const audioFiles = files.filter(f => f.toLowerCase().match(/\.(mp3|flac|wav)$/));
        return audioFiles.map(file => ({ name: file, path: 'file:///' + path.join(p, file).replace(/\\/g, '/') }));
    } catch (e) { return []; }
});

ipcMain.handle('get-ambient-files', async () => {
    const p = path.join(basePath, 'ambient');
    if (!fs.existsSync(p)) fs.mkdirSync(p);
    try {
        const files = fs.readdirSync(p);
        const audioFiles = files.filter(f => f.toLowerCase().match(/\.(mp3|flac|wav|ogg)$/));
        return audioFiles.map(file => ({ name: file, title: file.replace(/\.[^/.]+$/, ""), path: 'file:///' + path.join(p, file).replace(/\\/g, '/') }));
    } catch (e) { return []; }
});

// JSON Readers
const readJson = (file) => {
    const p = path.join(basePath, file);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    return {};
};

const writeJson = (file, data) => {
    const p = path.join(basePath, file);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
};

ipcMain.handle('get-scenes', () => readJson('scenes.json'));
ipcMain.handle('save-scenes', (e, data) => writeJson('scenes.json', data));

ipcMain.handle('get-analytics', () => {
    const data = readJson('analytics.json');
    if (!data.sessions) data.sessions = {};
    if (!data.trackStats) data.trackStats = {};
    if (!data.longestSession) data.longestSession = 0;
    return data;
});
ipcMain.handle('save-analytics', (e, data) => writeJson('analytics.json', data));

ipcMain.handle('get-achievements', () => readJson('achievements.json'));
ipcMain.handle('save-achievements', (e, data) => writeJson('achievements.json', data));

ipcMain.handle('get-daily', () => readJson('daily.json'));
ipcMain.handle('save-daily', (e, data) => writeJson('daily.json', data));

const userDataPath = app.getPath('userData');
const audiolabPath = path.join(userDataPath, 'audiolab.json');

ipcMain.handle('get-audiolab', () => {
    if (fs.existsSync(audiolabPath)) {
        return JSON.parse(fs.readFileSync(audiolabPath, 'utf8'));
    }
    return { presets: {}, deviceMappings: {} };
});

ipcMain.handle('save-audiolab', (e, data) => {
    fs.writeFileSync(audiolabPath, JSON.stringify(data, null, 2), 'utf8');
});

ipcMain.handle('scan-library', async (e) => {
    const libraryPath = path.join(basePath, 'library');
    const cachePath = path.join(basePath, 'cache');
    const artworkPath = path.join(cachePath, 'artwork');
    
    if (!fs.existsSync(cachePath)) fs.mkdirSync(cachePath);
    if (!fs.existsSync(artworkPath)) fs.mkdirSync(artworkPath);
    
    let libraryFiles = [];
    if (fs.existsSync(libraryPath)) {
        const files = fs.readdirSync(libraryPath);
        libraryFiles = files.filter(f => f.toLowerCase().match(/\.(mp3|flac|wav)$/));
    }
    
    let libraryIndex = [];
    const mm = await import('music-metadata');
    
    for (let i = 0; i < libraryFiles.length; i++) {
        const file = libraryFiles[i];
        const filePath = path.join(libraryPath, file);
        
        if (e.sender) {
            e.sender.send('library-scan-progress', { current: i + 1, total: libraryFiles.length, file });
        }
        
        try {
            const metadata = await mm.parseFile(filePath);
            console.log(`[SCAN] Processing: ${file}`);
            
            let baseName = path.basename(file, path.extname(file));
            let guessedArtist = '';
            let guessedTitle = baseName;
            if (baseName.includes(' - ')) {
                const parts = baseName.split(' - ');
                guessedArtist = parts[0].trim();
                guessedTitle = parts.slice(1).join(' - ').trim();
            }
            
            let finalTitle = metadata.common.title || guessedTitle;
            let finalArtist = metadata.common.artist || guessedArtist || 'Unknown Artist';
            let album = metadata.common.album || 'Unknown Album';
            
            const albumId = hashString(finalArtist + '_' + album);
            const artworkFile = path.join(artworkPath, albumId + '.jpg');
            console.log(`[SCAN]   albumId=${albumId}, artist="${finalArtist}", album="${album}"`);
            
            // Check if artwork is already cached
            if (!fs.existsSync(artworkFile)) {
                let saved = false;
                console.log(`[SCAN]   Artwork not cached yet. Searching...`);
                
                // Check for local folder images
                const localImages = ['cover.jpg', 'folder.jpg', 'album.jpg'];
                for (const img of localImages) {
                    const imgPath = path.join(libraryPath, img);
                    if (fs.existsSync(imgPath)) {
                        fs.copyFileSync(imgPath, artworkFile);
                        saved = true;
                        console.log(`[SCAN]   ✅ Found local folder image: ${img}`);
                        break;
                    }
                }
                
                // Check embedded ID3
                if (!saved && metadata.common.picture && metadata.common.picture.length > 0) {
                    const picture = metadata.common.picture[0];
                    console.log(`[SCAN]   ✅ Found embedded artwork: format=${picture.format}, size=${picture.data.length} bytes`);
                    fs.writeFileSync(artworkFile, picture.data);
                    saved = true;
                } else if (!saved) {
                    console.log(`[SCAN]   ⚠ No embedded artwork found (metadata.common.picture=${JSON.stringify(metadata.common.picture ? metadata.common.picture.length : null)})`);
                }
                
                // Fallback to iTunes
                if (!saved) {
                    console.log(`[SCAN]   Trying iTunes API fallback...`);
                    const query = encodeURIComponent(finalTitle + ' ' + finalArtist);
                    try {
                        const response = await fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`);
                        const data = await response.json();
                        if (data.results && data.results.length > 0) {
                            const artUrl = data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
                            const imgRes = await fetch(artUrl);
                            const arrayBuffer = await imgRes.arrayBuffer();
                            fs.writeFileSync(artworkFile, Buffer.from(arrayBuffer));
                            saved = true;
                            console.log(`[SCAN]   ✅ Downloaded artwork from iTunes`);
                        } else {
                            console.log(`[SCAN]   ⚠ iTunes returned no results`);
                        }
                    } catch (err) { console.error(`[SCAN]   ❌ iTunes fetch error:`, err.message); }
                }
                
                if (!saved) {
                    console.log(`[SCAN]   ❌ All artwork methods failed for: ${file}`);
                }
            }
            
            libraryIndex.push({
                name: file,
                path: 'file:///' + filePath.replace(/\\/g, '/'),
                title: finalTitle,
                artist: finalArtist,
                album: album,
                albumId: albumId
            });
            
        } catch (err) {
            console.error("Scan error for", file, err);
        }
    }
    
    writeJson('library_index.json', libraryIndex);
    return libraryIndex;
});

ipcMain.handle('get-library-index', () => {
    return readJson('library_index.json');
});

ipcMain.handle('get-track-metadata', async (e, filePath) => {
    // Deprecated for full metadata, but kept for legacy/compatibility if needed
    // The frontend should now rely on libraryIndex and cached artwork directly
    return null; 
});
