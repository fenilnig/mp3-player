# WayneTech Audio — Premium Desktop MP3 Player

A cinematic, dark-themed desktop music player built with **Electron**. Designed for audiophiles who want granular EQ control, ambient soundscapes, listening analytics, and a visually stunning interface — all running offline from a local library.

![Electron](https://img.shields.io/badge/Electron-43-47848f?logo=electron&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/license-ISC-blue)

---

## Features

| Feature | Description |
|---|---|
| **10-Band Parametric EQ** | Real-time Web Audio API equalizer with device-specific presets (KZ Castor, boAt Rockerz, EchoSpin, etc.) |
| **Ambient Mixer** | Layer rain, thunder, vinyl crackle and other ambient sounds over your music |
| **Listening Analytics** | Tracks play counts, session lengths, time-of-day habits, most replayed & most skipped |
| **Scene Associations** | Tag songs with emotional scenes ("Mr. Robot monologue", "late night drive") |
| **Multiple Themes** | Adaptive Blur, Vinyl, OLED, Cyberpunk, Pixel, WinAmp, and more |
| **3D Parallax Album Art** | Mouse-reactive tilt with specular glare overlay |
| **Holographic 3D Visualizer** | Three.js terrain + particles synced to audio frequency data |
| **Focus Mode** | Distraction-free full-width player view |
| **Automatic Artwork** | Pulls album art from embedded ID3 tags → local folder images → iTunes API |

---

## File Synopsis

### Core Application

| File | Purpose |
|---|---|
| `main.js` | **Electron main process.** Creates the BrowserWindow, handles IPC for file I/O (library scanning, JSON persistence, artwork caching via iTunes API fallback). Implements a smooth fade-out on app close. |
| `preload.js` | **Context bridge.** Securely exposes Node.js IPC channels (`getLibraryFiles`, `scanLibrary`, `saveAnalytics`, etc.) to the renderer via `contextBridge.exposeInMainWorld`. |
| `index.html` | **Application shell.** Full UI markup — player controls, playlist, EQ modal with 10 band sliders, ambient mixer drawer, analytics modal, scene association modal, and theme toolbar. |
| `app.js` | **Renderer logic (~1000 lines).** Handles playback (play/pause/skip/shuffle/repeat), library loading, EQ processing with `BiquadFilterNode` chains, ambient mixer with `GainNode`, analytics tracking, theme switching, keyboard shortcuts, and all UI interactions. |
| `style.css` | **All styling (~800 lines).** CSS custom properties for theming, layouts for player/playlist split, modal/drawer animations, vinyl record spin effect, focus mode, and theme-specific overrides (OLED, Cyberpunk, Pixel, WinAmp, etc.). |
| `visualizer3d.js` | **Three.js 3D visualizer.** Renders a wireframe terrain plane + floating particle system that react in real-time to audio analyser frequency data. Color-syncs to the current theme accent. |

### Configuration

| File | Purpose |
|---|---|
| `package.json` | Node project manifest. Dependencies: `electron`, `music-metadata`, `colorthief`. |
| `append.css` | Supplementary CSS for additional theme definitions (Pixel, WinAmp retro skins). |

### Assets

| File | Purpose |
|---|---|
| `icon.png` / `icon.ico` | Application icon (standard). |
| `icon_transparent.png` | Transparent PNG icon used for the Electron window. |
| `app_icon.ico` / `app_icon_v2.ico` | Alternative icon versions for shortcuts. |

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/mp3-player.git
cd mp3-player

# Install dependencies
npm install

# Drop your .mp3 / .flac / .wav files into the library/ folder
# (the folder is created automatically on first run)

# Launch
npm start
```

---

## Tech Stack

- **Electron 43** — Desktop shell with hidden titlebar overlay
- **Web Audio API** — Real-time 10-band parametric EQ + preamp gain
- **Three.js** (CDN) — 3D holographic visualizer
- **music-metadata** — ID3 tag parsing for title, artist, album, embedded artwork
- **ColorThief** — Dominant color extraction for adaptive theme
- **iTunes Search API** — Fallback artwork fetcher

---

## EQ Presets

| Preset | Target Device | Tuning Philosophy |
|---|---|---|
| Flat | Any | Zero gain across all bands |
| Bass Boost | Any | +6 dB sub-bass, tapering to flat |
| Acoustic / Vocal | Any | Mid-forward with presence lift |
| Rock | Any | V-shaped: boosted lows & highs |
| Electronic | Any | Sub-bass + air boost, scooped mids |
| KZ Castor | KZ Castor IEM | Harman-target: sub-bass bump, tamed 8 kHz, air |
| Saregama Carvaan | Saregama Carvaan | Vintage mid-forward, rolled-off extremes |
| boAt Rockerz 425 | boAt Rockerz 425 | Cuts muddy 250 Hz, boosts upper mids |
| **EchoSpin** | **Zebronics EchoSpin** | **+4 dB sub-bass, cut low-mids, gentle presence lift** |

---

## License

ISC
