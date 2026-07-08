const audio = document.getElementById('audio-element');
const playBtn = document.getElementById('play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const loopBtn = document.getElementById('loop-btn');
const progressBar = document.getElementById('progress-bar');
const volumeBar = document.getElementById('volume-bar');
const currentTimeEl = document.getElementById('current-time');
const totalTimeEl = document.getElementById('total-time');
const volumeIcon = document.getElementById('volume-icon');
const refreshBtn = document.getElementById('refresh-btn');
const eqBtn = document.getElementById('eq-btn');

let audioCtx;
let sourceNode;
let preampNode;
let analyserNode;
let eqBands = [];
const EQ_FREQS = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
let isEqEnabled = false;

function initAudioContext() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = audioCtx.createMediaElementSource(audio);
    
    preampNode = audioCtx.createGain();
    preampNode.gain.value = 1.0;
    
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 1024;
    analyserNode.smoothingTimeConstant = 0.85;
    
    // Create 10 EQ bands
    eqBands = EQ_FREQS.map((freq, index) => {
        const filter = audioCtx.createBiquadFilter();
        if (index === 0) filter.type = 'lowshelf';
        else if (index === EQ_FREQS.length - 1) filter.type = 'highshelf';
        else filter.type = 'peaking';
        
        filter.frequency.value = freq;
        filter.Q.value = 1.41;
        filter.gain.value = 0;
        return filter;
    });
    
    // Default routing: source -> analyser -> destination (Bypassed)
    sourceNode.connect(analyserNode);
    analyserNode.connect(audioCtx.destination);
    
    startSpectrumAnalyzer();
}

function updateAudioRouting() {
    if (!audioCtx) return;
    
    // Disconnect everything first
    sourceNode.disconnect();
    preampNode.disconnect();
    eqBands.forEach(band => band.disconnect());
    analyserNode.disconnect();
    
    if (isEqEnabled) {
        sourceNode.connect(preampNode);
        let currentNode = preampNode;
        eqBands.forEach(band => {
            currentNode.connect(band);
            currentNode = band;
        });
        currentNode.connect(analyserNode);
        analyserNode.connect(audioCtx.destination);
    } else {
        sourceNode.connect(analyserNode);
        analyserNode.connect(audioCtx.destination);
    }
}

function applyEqProfile(enable) {
    if (!audioCtx) initAudioContext();
    isEqEnabled = enable;
    updateAudioRouting();
    
    const toggle = document.getElementById('eq-enable-toggle');
    if (toggle) toggle.checked = enable;
    
    if (enable) {
        eqBtn.classList.add('active');
        eqBtn.style.color = 'var(--accent-color)';
    } else {
        eqBtn.classList.remove('active');
        eqBtn.style.color = '';
    }
}

// Spectrum Analyzer
let animationId;
function startSpectrumAnalyzer() {
    const canvas = document.getElementById('spectrum-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function draw() {
        animationId = requestAnimationFrame(draw);
        analyserNode.getByteFrequencyData(dataArray);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#e6b800';
        
        for(let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2;
            
            const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
            gradient.addColorStop(0, accent);
            gradient.addColorStop(1, '#ffffff');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }
    draw();
}

// EQ Presets
const audioLabPresets = {
    flat: [0,0,0,0,0,0,0,0,0,0],
    bass_boost: [6,5,4,2,0,0,0,0,0,0],
    acoustic: [2,1,0,1,2,3,4,4,3,2],
    rock: [4,3,1,-1,-2,-1,1,3,4,4],
    electronic: [5,4,2,0,-2,0,1,2,4,5],
    kz_castor: [2,1,0,0,0,1,2,-1,-2,3], // Sub-bass bump, tame 8k, air
    saregama_carvaan: [-4,-2,0,2,4,5,4,2,-1,-3], // Vintage mid-forward
    boat_rockerz: [0,-1,-3,-4,-2,1,3,2,1,0], // Cut muddy 250Hz, boost upper mids
    echospin: [4,2,-1,-2,0,1,2,1,0,-1]
};

function loadEqPreset(presetId) {
    if (!audioCtx) initAudioContext();
    const preset = audioLabPresets[presetId] || audioLabPresets.flat;
    
    // Reset Preamp
    preampNode.gain.value = 1.0;
    document.getElementById('eq-preamp').value = 0;
    document.getElementById('gain-val-preamp').textContent = "0.0dB";

    // Set 10 bands
    preset.forEach((val, i) => {
        eqBands[i].gain.value = val;
        const slider = document.querySelector(`.band-slider[data-index="${i}"]`);
        if (slider) slider.value = val;
        const label = document.getElementById(`gain-val-${i}`);
        if (label) label.textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)}dB`;
    });
}

let currentAudioDevice = 'default';
let deviceMappings = {};

async function updateAudioDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
    
    const select = document.getElementById('audio-device-select');
    if (!select) return;
    
    const currentValue = select.value;
    select.innerHTML = '';
    
    // Always add default option
    const defaultOpt = document.createElement('option');
    defaultOpt.value = 'default';
    defaultOpt.text = 'System Default';
    select.appendChild(defaultOpt);
    
    audioOutputs.forEach(device => {
        if (device.deviceId === 'default') return;
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Device ${device.deviceId.substring(0,5)}...`;
        select.appendChild(option);
    });
    
    if (audioOutputs.find(d => d.deviceId === currentValue)) {
        select.value = currentValue;
    }
}
navigator.mediaDevices.addEventListener('devicechange', updateAudioDevices);
updateAudioDevices();

document.getElementById('audio-device-select').addEventListener('change', async (e) => {
    const deviceId = e.target.value;
    currentAudioDevice = deviceId;
    try {
        if (typeof audio.setSinkId === 'function') {
            await audio.setSinkId(deviceId === 'default' ? '' : deviceId);
        }
        
        // Auto-switch preset based on device mapping
        const mappedPreset = deviceMappings[deviceId] || 'flat';
        document.getElementById('eq-preset-select').value = mappedPreset;
        loadEqPreset(mappedPreset);
        
    } catch (err) {
        console.error('Error setting audio output:', err);
    }
});

const trackTitle = document.getElementById('track-title');
const trackArtist = document.getElementById('track-artist');
const coverImage = document.getElementById('cover-image');
const coverPlaceholder = document.getElementById('cover-placeholder');

function resetCover() {
    console.log('[ART] resetCover: clearing image');
    coverImage.onload = null;
    coverImage.onerror = null;
    coverImage.src = '';
    coverImage.style.display = 'none';
    coverPlaceholder.style.display = 'flex';
    dynamicBg.style.backgroundImage = 'none';
}

const albumArtElements = document.querySelectorAll('.album-art, .album-art-container');
const playlistEl = document.getElementById('playlist');

// UI Elements
const themeBtn = document.getElementById('theme-btn');
const themeLabel = document.getElementById('theme-label');
const focusBtn = document.getElementById('focus-btn');
const dynamicBg = document.getElementById('dynamic-bg');

// New Components
const sceneDisplay = document.getElementById('scene-display');
const sceneText = document.getElementById('scene-text');
const sceneModal = document.getElementById('scene-modal');
const sceneInput = document.getElementById('scene-input');
const sceneSaveBtn = document.getElementById('scene-save');
const sceneCancelBtn = document.getElementById('scene-cancel');

const mixerBtn = document.getElementById('mixer-btn');
const mixerDrawer = document.getElementById('mixer-drawer');
const mixerClose = document.getElementById('mixer-close');
const mixerTracks = document.getElementById('mixer-tracks');
const ambientContainer = document.getElementById('ambient-audio-container');

const analyticsBtn = document.getElementById('analytics-btn');
const analyticsModal = document.getElementById('analytics-modal');
const analyticsClose = document.getElementById('analytics-close');
const sessionTagSelect = document.getElementById('session-tag');

let playlist = [];
let originalPlaylist = [];
let currentTrackIndex = 0;
let isPlaying = false;
let isShuffle = false;
let loopMode = 0; 
let isFocusMode = false;

// Dynamic Color Extraction (replaces ColorThief)
function extractDominantColor(imgElement) {
    return new Promise((resolve) => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            canvas.width = 50;
            canvas.height = 50;
            ctx.drawImage(imgElement, 0, 0, 50, 50);
            const data = ctx.getImageData(0, 0, 50, 50).data;
            
            // K-means-lite: bucket colors and find dominant
            const buckets = {};
            for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel
                const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
                if (a < 128) continue;
                // Quantize to 32-step buckets
                const qr = (r >> 5) << 5;
                const qg = (g >> 5) << 5;
                const qb = (b >> 5) << 5;
                // Skip very dark and very bright colors
                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                if (brightness < 30 || brightness > 240) continue;
                // Skip very desaturated colors
                const max = Math.max(r, g, b), min = Math.min(r, g, b);
                if (max - min < 20) continue;
                const key = `${qr},${qg},${qb}`;
                if (!buckets[key]) buckets[key] = { r: 0, g: 0, b: 0, count: 0 };
                buckets[key].r += r;
                buckets[key].g += g;
                buckets[key].b += b;
                buckets[key].count++;
            }
            
            let best = null, bestCount = 0;
            for (const key in buckets) {
                if (buckets[key].count > bestCount) {
                    bestCount = buckets[key].count;
                    best = buckets[key];
                }
            }
            
            if (best && best.count > 0) {
                resolve([
                    Math.round(best.r / best.count),
                    Math.round(best.g / best.count),
                    Math.round(best.b / best.count)
                ]);
            } else {
                resolve([230, 184, 0]); // fallback to gold
            }
        } catch (e) {
            console.error('[COLOR] extraction failed:', e);
            resolve([230, 184, 0]);
        }
    });
}

function applyDynamicColors(r, g, b) {
    const root = document.documentElement;
    root.style.setProperty('--dynamic-rgb', `${r}, ${g}, ${b}`);
    // Only tint accent colors when on adaptive theme
    if (document.body.classList.contains('theme-adaptive')) {
        root.style.setProperty('--accent-color', `rgb(${r}, ${g}, ${b})`);
        root.style.setProperty('--glow-effect', `0 0 20px rgba(${r}, ${g}, ${b}, 0.4)`);
    }
    console.log('[COLOR] Applied dynamic tint:', r, g, b);
}

// Gamification
let achievements = {};
let dailyState = {};
let currentAlbumPlayCount = 0;
let currentAlbumName = null;

// Databases
let scenes = {};
let analytics = { sessions: {}, trackStats: {}, longestSession: 0 };
let sessionStartTime = Date.now();
let trackStartTime = 0;

const themes = [
    { class: 'theme-adaptive', name: 'ADAPTIVE BLUR' },
    { class: 'theme-vinyl', name: 'VINYL MODE' },
    { class: 'theme-oled', name: 'MINIMAL OLED' },
    { class: 'theme-cyberpunk', name: 'CYBERPUNK' }
];
let currentThemeIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
    
    // Load databases
    scenes = await window.electronAPI.getScenes();
    analytics = await window.electronAPI.getAnalytics();
    achievements = await window.electronAPI.getAchievements() || {};
    dailyState = await window.electronAPI.getDaily() || {};
    
    // Load Audio Lab data
    try {
        if (window.electronAPI.getAudioLabData) {
            const labData = await window.electronAPI.getAudioLabData();
            if (labData && labData.deviceMappings) {
                deviceMappings = labData.deviceMappings;
            }
        }
    } catch(e) {
        console.warn("Audio Lab data could not be loaded", e);
    }
    
    loadLibrary();
    loadMixer();
    startAnalyticsTimer();
    checkDailyChallenge();
    
    window.electronAPI.onCloseAnimation(() => {
        document.body.style.opacity = '0';
    });
});

themeBtn.addEventListener('click', () => {
    document.body.classList.remove(themes[currentThemeIndex].class);
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    document.body.classList.add(themes[currentThemeIndex].class);
    themeLabel.textContent = themes[currentThemeIndex].name;
    
    // Reset to default gold accent unless adaptive theme is active
    if (themes[currentThemeIndex].class !== 'theme-adaptive') {
        document.documentElement.style.removeProperty('--accent-color');
        document.documentElement.style.removeProperty('--glow-effect');
        document.documentElement.style.removeProperty('--dynamic-rgb');
    }
});

focusBtn.addEventListener('click', () => {
    isFocusMode = !isFocusMode;
    if (isFocusMode) {
        document.body.classList.add('focus-mode');
        focusBtn.style.color = 'var(--accent-color)';
    } else {
        document.body.classList.remove('focus-mode');
        focusBtn.style.color = '';
    }
});

// Scene Logic
sceneDisplay.addEventListener('click', () => {
    if (playlist.length === 0) return;
    const currentPath = playlist[currentTrackIndex].path;
    sceneInput.value = scenes[currentPath] || '';
    sceneModal.classList.add('show');
    sceneInput.focus();
});

sceneCancelBtn.addEventListener('click', () => sceneModal.classList.remove('show'));
sceneSaveBtn.addEventListener('click', () => {
    const currentPath = playlist[currentTrackIndex].path;
    const val = sceneInput.value.trim();
    if (val) {
        scenes[currentPath] = val;
        sceneText.textContent = val;
    } else {
        delete scenes[currentPath];
        sceneText.textContent = 'Add Scene Association...';
    }
    window.electronAPI.saveScenes(scenes);
    sceneModal.classList.remove('show');
});

// Mixer Logic
mixerBtn.addEventListener('click', () => mixerDrawer.classList.add('show'));
mixerClose.addEventListener('click', () => mixerDrawer.classList.remove('show'));

async function loadMixer() {
    const ambientFiles = await window.electronAPI.getAmbientFiles();
    mixerTracks.innerHTML = '';
    ambientContainer.innerHTML = '';
    
    if (ambientFiles.length === 0) {
        mixerTracks.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5; font-size: 12px;">Add MP3 sound loops (e.g., Rain, Cafe) to the <b>/ambient</b> folder to mix them here!</div>';
        return;
    }
    
    ambientFiles.forEach(file => {
        const aud = document.createElement('audio');
        aud.src = file.path;
        aud.loop = true;
        ambientContainer.appendChild(aud);

        const div = document.createElement('div');
        div.className = 'mixer-track';
        div.innerHTML = `
            <span>${file.title}</span>
            <input type="range" class="ambient-slider" min="0" max="100" value="0">
        `;
        const slider = div.querySelector('input');
        slider.addEventListener('input', () => {
            aud.volume = slider.value / 100;
            if (slider.value > 0 && aud.paused) aud.play();
            else if (slider.value == 0 && !aud.paused) aud.pause();
        });
        mixerTracks.appendChild(div);
    });
}

// Audio Lab Logic
const audioLabModal = document.getElementById('audiolab-modal');
const audioLabClose = document.getElementById('audiolab-close');
const eqPresetSelect = document.getElementById('eq-preset-select');
const eqEnableToggle = document.getElementById('eq-enable-toggle');
const preampSlider = document.getElementById('eq-preamp');

eqBtn.addEventListener('click', () => audioLabModal.classList.add('show'));
audioLabClose.addEventListener('click', () => audioLabModal.classList.remove('show'));

eqEnableToggle.addEventListener('change', (e) => applyEqProfile(e.target.checked));

eqPresetSelect.addEventListener('change', (e) => {
    const newPreset = e.target.value;
    loadEqPreset(newPreset);
    
    // Save mapping for current device
    deviceMappings[currentAudioDevice] = newPreset;
    if (window.electronAPI.saveAudioLabData) {
        window.electronAPI.saveAudioLabData({ deviceMappings });
    }
});

preampSlider.addEventListener('input', (e) => {
    if (!audioCtx) initAudioContext();
    const val = parseFloat(e.target.value);
    preampNode.gain.value = Math.pow(10, val / 20); // convert dB to linear gain
    document.getElementById('gain-val-preamp').textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)}dB`;
});

document.querySelectorAll('.band-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
        if (!audioCtx) initAudioContext();
        const index = parseInt(e.target.dataset.index);
        const val = parseFloat(e.target.value);
        eqBands[index].gain.value = val;
        document.getElementById(`gain-val-${index}`).textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)}dB`;
    });
});

// Analytics Logic
analyticsBtn.addEventListener('click', () => {
    updateAnalyticsUI();
    analyticsModal.classList.add('show');
});
analyticsClose.addEventListener('click', () => analyticsModal.classList.remove('show'));

function startAnalyticsTimer() {
    setInterval(() => {
        if (!isPlaying) return;
        const tag = sessionTagSelect.value;
        if (!analytics.sessions) analytics.sessions = {};
        
        // Add 1 minute to the active session tag
        analytics.sessions[tag] = (analytics.sessions[tag] || 0) + 1;
        
        // Check Night time
        const hour = new Date().getHours();
        if (hour >= 22 || hour < 6) {
            analytics.sessions['Night'] = (analytics.sessions['Night'] || 0) + 1;
        }
        
        // Update longest session
        const currentSessionLen = Math.floor((Date.now() - sessionStartTime) / 60000);
        if (currentSessionLen > (analytics.longestSession || 0)) {
            analytics.longestSession = currentSessionLen;
        }
        
        window.electronAPI.saveAnalytics(analytics);
    }, 60000);
}

function recordTrackEndStats() {
    if (playlist.length === 0 || trackStartTime === 0) return;
    const currentTrack = playlist[currentTrackIndex];
    if (!analytics.trackStats) analytics.trackStats = {};
    if (!analytics.trackStats[currentTrack.path]) analytics.trackStats[currentTrack.path] = { plays: 0, skips: 0, title: currentTrack.title };
    
    const durationPlayed = (Date.now() - trackStartTime) / 1000;
    if (durationPlayed < 5) {
        analytics.trackStats[currentTrack.path].skips++;
    } else if (durationPlayed > 30) {
        analytics.trackStats[currentTrack.path].plays++;
    }
    window.electronAPI.saveAnalytics(analytics);
}

function updateAnalyticsUI() {
    const s = analytics.sessions || {};
    document.getElementById('stat-normal').textContent = Math.round((s['Normal'] || 0) / 60 * 10) / 10 + 'h';
    document.getElementById('stat-editing').textContent = Math.round((s['Editing'] || 0) / 60 * 10) / 10 + 'h';
    document.getElementById('stat-reading').textContent = Math.round((s['Reading'] || 0) / 60 * 10) / 10 + 'h';
    document.getElementById('stat-coding').textContent = Math.round((s['Coding'] || 0) / 60 * 10) / 10 + 'h';
    document.getElementById('stat-night').textContent = Math.round((s['Night'] || 0) / 60 * 10) / 10 + 'h';
    document.getElementById('stat-session').textContent = (analytics.longestSession || 0) + 'm';
    
    let maxPlays = 0, topPlayed = 'None';
    let maxSkips = 0, topSkipped = 'None';
    
    if (analytics.trackStats) {
        Object.values(analytics.trackStats).forEach(stat => {
            if (stat.plays > maxPlays) { maxPlays = stat.plays; topPlayed = stat.title; }
            if (stat.skips > maxSkips) { maxSkips = stat.skips; topSkipped = stat.title; }
        });
    }
    
    document.getElementById('stat-replayed').textContent = topPlayed;
    document.getElementById('stat-skipped').textContent = topSkipped;
}

refreshBtn.addEventListener('click', loadLibrary);

let isScanning = false;

window.electronAPI.onScanProgress((data) => {
    const percent = Math.round((data.current / data.total) * 100);
    playlistEl.innerHTML = `<div class="empty-state">
        <i class="ri-loader-4-line ri-spin"></i>
        <p style="margin-bottom: 5px;">INDEXING DATABANKS... ${percent}%</p>
        <p style="font-size: 10px; opacity: 0.5; margin: 0; word-break: break-all; padding: 0 10px;">${data.file}</p>
    </div>`;
});

async function loadLibrary() {
    playlistEl.innerHTML = '<div class="empty-state"><i class="ri-loader-4-line ri-spin"></i><p>ACCESSING DATABANKS...</p></div>';
    
    const rawFiles = await window.electronAPI.getLibraryFiles();
    let indexData = await window.electronAPI.getLibraryIndex();
    
    // Trigger background scan if index doesn't match raw folder
    if (!indexData || indexData.length !== rawFiles.length) {
        if (!isScanning) {
            isScanning = true;
            indexData = await window.electronAPI.scanLibrary();
            isScanning = false;
        }
    }
    
    if (indexData && indexData.length > 0) {
        originalPlaylist = indexData.map(f => ({ 
            name: f.name, 
            path: f.path, 
            title: f.title, 
            artist: f.artist,
            album: f.album,
            albumId: f.albumId
        }));
        
        originalPlaylist.sort((a, b) => a.name.localeCompare(b.name));
        
        let currentTrackPath = null;
        if (playlist && playlist.length > 0 && currentTrackIndex >= 0 && currentTrackIndex < playlist.length) {
            currentTrackPath = playlist[currentTrackIndex].path;
        }
        
        playlist = isShuffle ? [...originalPlaylist].sort(() => Math.random() - 0.5) : [...originalPlaylist];
        
        if (currentTrackPath) {
            const newIndex = playlist.findIndex(t => t.path === currentTrackPath);
            if (newIndex !== -1) currentTrackIndex = newIndex;
        }
        
        renderPlaylist();
        updatePlaylistHighlight();
        if (!isPlaying && playlist.length > 0) loadTrack(currentTrackIndex, false);
    } else {
        playlistEl.innerHTML = '<div class="empty-state"><i class="ri-folder-warning-line"></i><p>DATABANK EMPTY. ADD FILES TO /library.</p></div>';
    }
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

playBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', () => { currentAlbumPlayCount = 0; recordTrackEndStats(); playPrev(); });
nextBtn.addEventListener('click', () => { currentAlbumPlayCount = 0; recordTrackEndStats(); playNext(false); });
shuffleBtn.addEventListener('click', toggleShuffle);
loopBtn.addEventListener('click', toggleLoop);

document.getElementById('random-soundtrack-btn').addEventListener('click', () => {
    if (playlist.length === 0) return;
    isShuffle = true;
    shuffleBtn.classList.add('active');
    playlist = [...originalPlaylist].sort(() => Math.random() - 0.5);
    renderPlaylist();
    loadTrack(0, true);
    showToast("Surprise Me!", "Playing a random soundtrack mix.", "ri-magic-line");
});

audio.addEventListener('timeupdate', updateProgress);
audio.addEventListener('ended', () => { recordTrackEndStats(); handleTrackEnd(); });
audio.addEventListener('loadedmetadata', () => { totalTimeEl.textContent = formatTime(audio.duration); progressBar.max = audio.duration; });

progressBar.addEventListener('input', () => audio.currentTime = progressBar.value);
volumeBar.addEventListener('input', () => { audio.volume = volumeBar.value / 100; updateVolumeIcon(); });

function updateVolumeIcon() {
    if (audio.volume === 0) volumeIcon.className = 'ri-volume-mute-fill';
    else if (audio.volume < 0.5) volumeIcon.className = 'ri-volume-down-fill';
    else volumeIcon.className = 'ri-volume-up-fill';
}

function togglePlay() {
    if (playlist.length === 0) return;
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (isPlaying) {
        audio.pause();
        playBtn.innerHTML = '<i class="ri-play-fill"></i>';
        albumArtElements.forEach(el => el.classList.remove('playing'));
    } else {
        audio.play().catch(e => console.error(e));
        playBtn.innerHTML = '<i class="ri-pause-fill"></i>';
        albumArtElements.forEach(el => el.classList.add('playing'));
    }
    isPlaying = !isPlaying;
}

function updateProgress() {
    if (!audio.duration) return;
    progressBar.value = audio.currentTime;
    currentTimeEl.textContent = formatTime(audio.currentTime);
}

function toggleShuffle() {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
    if (playlist.length === 0) return;
    const currentTrack = playlist[currentTrackIndex];
    playlist = isShuffle ? [...originalPlaylist].sort(() => Math.random() - 0.5) : [...originalPlaylist];
    currentTrackIndex = playlist.findIndex(t => t.path === currentTrack.path);
    renderPlaylist();
    updatePlaylistHighlight();
}

function toggleLoop() {
    loopMode = (loopMode + 1) % 3;
    if (loopMode === 0) { loopBtn.className = 'control-btn-small'; loopBtn.innerHTML = '<i class="ri-repeat-line"></i>'; }
    else if (loopMode === 1) { loopBtn.className = 'control-btn-small active'; loopBtn.innerHTML = '<i class="ri-repeat-line"></i>'; }
    else { loopBtn.className = 'control-btn-small active'; loopBtn.innerHTML = '<i class="ri-repeat-one-line"></i>'; }
}

function renderPlaylist() {
    playlistEl.innerHTML = '';
    playlist.forEach((track, index) => {
        const li = document.createElement('li');
        li.className = `playlist-item ${index === currentTrackIndex ? 'active' : ''}`;
        li.innerHTML = `
            <div class="playlist-item-index">${index + 1}</div>
            <div class="playlist-item-info">
                <div class="playlist-item-title">${track.title}</div>
                <div class="playlist-item-artist">${track.artist}</div>
            </div>
        `;
        li.addEventListener('click', () => {
            if (currentTrackIndex !== index) { recordTrackEndStats(); loadTrack(index, true); }
            else togglePlay();
        });
        playlistEl.appendChild(li);
    });
}

function updatePlaylistHighlight() {
    document.querySelectorAll('.playlist-item').forEach((item, i) => {
        item.classList.toggle('active', i === currentTrackIndex);
        if (i === currentTrackIndex) item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
}

function loadTrack(index, autoPlay = true) {
    if (playlist.length === 0) return;
    currentTrackIndex = index;
    const track = playlist[index];
    
    audio.src = track.path;
    trackTitle.textContent = track.title;
    trackArtist.textContent = track.artist;
    
    // Load Scene
    sceneText.textContent = scenes[track.path] || 'Add Scene Association...';
    
    console.log('[ART] loadTrack: resetting cover, then extracting metadata for index', index);
    resetCover();
    extractMetadata(track.path, index);
    updatePlaylistHighlight();
    
    trackStartTime = Date.now();
    
    if (autoPlay || isPlaying) {
        audio.play().then(() => {
            isPlaying = true;
            playBtn.innerHTML = '<i class="ri-pause-fill"></i>';
            albumArtElements.forEach(el => el.classList.add('playing'));
        }).catch(e => console.error(e));
    }
}

function handleTrackEnd() {
    if (loopMode === 2) { audio.currentTime = 0; audio.play(); trackStartTime = Date.now(); }
    else playNext(true);
}

function playNext(isAuto = false) {
    if (playlist.length === 0) return;
    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= playlist.length) {
        if (loopMode === 1 || !isAuto) nextIndex = 0;
        else {
            isPlaying = false;
            playBtn.innerHTML = '<i class="ri-play-fill"></i>';
            albumArtElements.forEach(el => el.classList.remove('playing'));
            audio.currentTime = 0;
            return;
        }
    }
    loadTrack(nextIndex, isPlaying || isAuto);
}

function playPrev() {
    if (playlist.length === 0) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; if (isPlaying) audio.play(); trackStartTime = Date.now(); return; }
    let prevIndex = currentTrackIndex - 1;
    if (prevIndex < 0) prevIndex = playlist.length - 1; 
    loadTrack(prevIndex, isPlaying);
}

function setAdaptiveColor(imgSrc) {
    dynamicBg.style.backgroundImage = `url("${imgSrc}")`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
        const color = await extractDominantColor(img);
        applyDynamicColors(color[0], color[1], color[2]);
    };
    img.src = imgSrc;
}

async function extractMetadata(fileUrl, index) {
    try {
        const track = playlist[index];
        const album = track.album || 'Unknown Album';
        
        // Gamification Logic
        if (album !== 'Unknown Album') {
            if (currentAlbumName === album) {
                currentAlbumPlayCount++;
                if (currentAlbumPlayCount === 5) {
                    unlockAchievement('full_album', 'True Listener', `Listened to 5 tracks from ${album} without skipping.`);
                }
            } else {
                currentAlbumName = album;
                currentAlbumPlayCount = 1;
            }
        } else {
            currentAlbumName = null;
            currentAlbumPlayCount = 0;
        }
        
        // Use pre-indexed metadata instantly
        trackTitle.textContent = track.title;
        trackArtist.textContent = track.artist;
        
        // Update playlist highlight dynamically if needed
        const items = document.querySelectorAll('.playlist-item');
        if (items[index]) {
            items[index].querySelector('.playlist-item-title').textContent = track.title;
            items[index].querySelector('.playlist-item-artist').textContent = track.artist;
        }

        // Load artwork from cache - use relative path from index.html directory
        // Add cache-buster to prevent stale 404 caching
        const artRelPath = '../cache/artwork/' + track.albumId + '.jpg?' + Date.now();
        console.log('[ART] Loading artwork for "' + track.title + '" albumId=' + track.albumId);
        console.log('[ART] Relative path:', artRelPath);
        
        // Temporarily remove the global onerror to prevent race condition
        coverImage.onerror = null;
        coverImage.onload = () => {
            console.log('[ART] ✅ coverImage loaded successfully for', track.title);
            coverImage.style.display = 'block';
            coverPlaceholder.style.display = 'none';
            setAdaptiveColor(coverImage.src);
        };
        coverImage.onerror = () => {
            console.warn('[ART] ❌ coverImage failed for', track.title, 'src:', coverImage.src);
            resetCoverWithInitials(track.album);
        };
        coverImage.src = artRelPath;
        
    } catch (err) {
        console.error('[ART] extractMetadata error:', err);
        resetCoverWithInitials(playlist[index] ? playlist[index].album : null);
    }
}

function resetCoverWithInitials(albumName) {
    coverImage.style.display = 'none';
    coverPlaceholder.style.display = 'flex'; 
    dynamicBg.style.backgroundImage = 'none';
    
    let initials = 'WT';
    if (albumName && albumName !== 'Unknown Album') {
        initials = albumName.substring(0, 2).toUpperCase();
    }
    
    // Generate clean SVG placeholder
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
        <rect width="600" height="600" fill="#181818" />
        <text x="50%" y="50%" font-family="Arial" font-size="200" fill="#333" font-weight="bold" dominant-baseline="middle" text-anchor="middle">${initials}</text>
    </svg>`;
    
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    coverImage.src = url;
    coverImage.style.display = 'block';
    coverPlaceholder.style.display = 'none';
}

// Gamification Engine
function showToast(title, message, icon = 'ri-trophy-line') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <i class="${icon}"></i>
        <div class="toast-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
    `;
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 5000);
}

function unlockAchievement(id, title, desc) {
    if (achievements[id]) return;
    achievements[id] = true;
    window.electronAPI.saveAchievements(achievements);
    showToast("Achievement Unlocked!", title);
}

function checkDailyChallenge() {
    const today = new Date().toDateString();
    if (dailyState.date !== today) {
        dailyState.date = today;
        setTimeout(() => showToast("Daily Challenge", "Listen to a full album without skipping!", "ri-calendar-event-line"), 3000);
        window.electronAPI.saveDaily(dailyState);
    }
}

// EQ Listeners
eqBtn.addEventListener('click', () => {
    applyEqProfile(!isEqEnabled);
    if (isEqEnabled) {
        showToast('Echospin EQ Enabled', 'Audiophile DSP profile active.');
    } else {
        showToast('EQ Disabled', 'Bypassed to flat response.');
    }
});

// Known Bluetooth device → EQ preset mappings
const knownBluetoothDevices = [
    { keywords: ['zebronics', 'echospin'], preset: 'echospin', name: 'Zebronics EchoSpin' },
    { keywords: ['boat', 'rockerz', 'boat rockerz'], preset: 'boat_rockerz', name: 'boAt Rockerz 425' }
];

let activeBluetoothDevice = null;

function detectKnownDevice(devices) {
    const outputs = devices.filter(d => d.kind === 'audiooutput');
    for (const known of knownBluetoothDevices) {
        const found = outputs.find(d => 
            known.keywords.some(kw => d.label.toLowerCase().includes(kw))
        );
        if (found) return known;
    }
    return null;
}

navigator.mediaDevices.ondevicechange = async () => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const detected = detectKnownDevice(devices);
        
        if (detected && (!activeBluetoothDevice || activeBluetoothDevice.preset !== detected.preset)) {
            // New known device connected
            activeBluetoothDevice = detected;
            loadEqPreset(detected.preset);
            document.getElementById('eq-preset-select').value = detected.preset;
            applyEqProfile(true);
            showToast(`${detected.name} Connected!`, `Auto-applying ${detected.name} EQ profile.`);
        } else if (!detected && activeBluetoothDevice) {
            // Known device disconnected
            const prevName = activeBluetoothDevice.name;
            activeBluetoothDevice = null;
            loadEqPreset('flat');
            document.getElementById('eq-preset-select').value = 'flat';
            applyEqProfile(false);
            showToast(`${prevName} Disconnected`, 'Restoring flat audio profile.');
        }
    } catch (e) { console.error('Device enum error:', e); }
};

// Initial check on app start
navigator.mediaDevices.enumerateDevices().then(devices => {
    const detected = detectKnownDevice(devices);
    if (detected) {
        activeBluetoothDevice = detected;
        loadEqPreset(detected.preset);
        document.getElementById('eq-preset-select').value = detected.preset;
        applyEqProfile(true);
        setTimeout(() => showToast(`${detected.name} Detected`, `${detected.name} EQ Auto-Engaged.`), 2000);
    }
}).catch(e => console.error(e));

// 3D Parallax Album Art Effect
document.querySelectorAll('.album-art-container').forEach(container => {
    const art = container.querySelector('.album-art');
    if (!art) return;
    
    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = ((y - centerY) / centerY) * -15; 
        const rotateY = ((x - centerX) / centerX) * 15;
        
        art.style.setProperty('--rotate-x', `${rotateX}deg`);
        art.style.setProperty('--rotate-y', `${rotateY}deg`);
        
        const glareX = (x / rect.width) * 100;
        const glareY = (y / rect.height) * 100;
        
        art.style.setProperty('--glare-x', `${glareX}%`);
        art.style.setProperty('--glare-y', `${glareY}%`);
    });
    
    container.addEventListener('mouseleave', () => {
        art.style.setProperty('--rotate-x', '0deg');
        art.style.setProperty('--rotate-y', '0deg');
        art.style.setProperty('--glare-x', '50%');
        art.style.setProperty('--glare-y', '50%');
    });
});

// Click outside to close modals and drawers
window.addEventListener('click', (e) => {
    // Modals
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
    }
    
    // Mixer Drawer
    if (typeof mixerDrawer !== 'undefined' && mixerDrawer.classList.contains('show')) {
        // Only close if clicking outside the mixer, and not on the mixer button itself
        const mixerBtn = document.getElementById('mixer-btn');
        if (!mixerDrawer.contains(e.target) && (!mixerBtn || !mixerBtn.contains(e.target))) {
            mixerDrawer.classList.remove('show');
        }
    }
});
