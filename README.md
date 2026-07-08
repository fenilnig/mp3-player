# WayneTech Audio — Premium Desktop MP3 Player

A cinematic, dark-themed desktop music player built with **Electron**. Designed for audiophiles who want granular EQ control, ambient soundscapes, listening analytics, and a visually stunning interface — all running offline from a local library.

![Electron](https://img.shields.io/badge/Electron-43-47848f?logo=electron&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/license-ISC-blue)

---

## Features

| Feature | Description |
|---|---|
| **Immersive 3D Visualizer Mode** | A dedicated full-screen mode featuring three interactive audio-reactive environments: Pulse Sphere, Frequency Bars, and Terrain Waves. Fully controllable via mouse drag/scroll. |
| **Bluetooth EQ Auto-Detection** | Seamlessly detects known headphones (e.g., EchoSpin, boAt Rockerz) upon connection and automatically loads their custom parametric EQ profile. |
| **Audio Lab & 10-Band EQ** | A dedicated mixing modal containing a real-time Web Audio API equalizer, preamp slider, and spectrum analyzer. |
| **Ambient Mixer** | Layer rain, thunder, vinyl crackle, and other ambient soundscapes over your music. |
| **Listening Analytics** | Tracks play counts, session lengths, time-of-day habits, most replayed & most skipped songs. |
| **Scene Associations** | Tag songs with emotional scenes ("Mr. Robot monologue", "late night drive"). |
| **Multiple Themes** | Adaptive Blur (auto-colors based on album art), Vinyl, OLED, Cyberpunk, Pixel, and WinAmp. |
| **3D Parallax Album Art** | Mouse-reactive tilt with specular glare overlay. |
| **Focus Mode** | Distraction-free full-width player view. |

---

## File Synopsis

### Core Application

| File | Purpose |
|---|---|
| `main.js` | **Electron main process.** Creates the BrowserWindow, handles IPC for file I/O (library scanning, JSON persistence, artwork caching via iTunes API fallback). Implements a smooth fade-out on app close. |
| `preload.js` | **Context bridge.** Securely exposes Node.js IPC channels (`getLibraryFiles`, `scanLibrary`, `saveAnalytics`, etc.) to the renderer. |
| `index.html` | **Application shell.** Full UI markup — player controls, playlist, Audio Lab modal, ambient mixer drawer, and the dedicated full-screen 3D controls overlay. |
| `app.js` | **Renderer logic (~1000 lines).** Handles playback, EQ processing with `BiquadFilterNode` chains, Bluetooth device detection, analytics tracking, theme switching, and all UI interactions. |
| `style.css` | **All styling (~800 lines).** CSS custom properties for theming, responsive player layouts, full-screen visualizer overrides, and theme-specific rules. |
| `visualizer3d.js` | **Three.js 3D visualizer.** Contains the rendering logic for the dedicated 3D mode, mapping real-time frequency data to geometry (Sphere, Bars, Waves) and handling mouse parallax/orbit controls. |

### Configuration & Assets

| File | Purpose |
|---|---|
| `package.json` | Node project manifest. |
| `three.min.js` | Locally bundled Three.js library for instant, offline visualizer booting. |
| `icon.png` / `icon.ico` | Application icons. |

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/fenilnig/mp3-player.git
cd mp3-player

# Install dependencies
npm install

# Drop your .mp3 / .flac / .wav files into the library/ folder
# (the folder is created automatically on first run)

# Build and Package the application into a standalone .exe
npx electron-packager . WayneTechAudio --platform=win32 --arch=x64 --out=dist --overwrite

# Launch the packaged application instantly
# Go to dist/WayneTechAudio-win32-x64/ and run WayneTechAudio.exe
```

---

## Tech Stack

- **Electron 43** — Desktop shell with hidden titlebar overlay
- **Web Audio API** — Real-time 10-band parametric EQ + preamp gain
- **Three.js** (Locally bundled) — Interactive full-screen 3D visualizers
- **music-metadata** — ID3 tag parsing for title, artist, album, embedded artwork
- **ColorThief** — Dominant color extraction for the adaptive UI theme
- **iTunes Search API** — Fallback artwork fetcher

---

## EQ Presets

The Audio Lab comes loaded with carefully tuned presets tailored for specific hardware, featuring automatic Bluetooth detection:

| Preset | Target Device | Tuning Philosophy |
|---|---|---|
| **EchoSpin** | **Zebronics EchoSpin** | **+4 dB sub-bass, cut muddy low-mids, gentle presence lift (Auto-detected)** |
| **boAt Rockerz 425** | **boAt Rockerz 425** | **Cuts muddy 250 Hz, boosts upper mids for vocal clarity (Auto-detected)** |
| Flat | Any | Zero gain across all bands |
| Bass Boost | Any | +6 dB sub-bass, tapering to flat |
| Acoustic / Vocal | Any | Mid-forward with presence lift |
| Rock | Any | V-shaped: boosted lows & highs |
| Electronic | Any | Sub-bass + air boost, scooped mids |
| KZ Castor | KZ Castor IEM | Harman-target: sub-bass bump, tamed 8 kHz, air |

---

## License

ISC
