# Building the Nexus HQ Desktop App

## Prerequisites

### All platforms

```bash
# 1. Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# 2. Install npm dependencies (adds @tauri-apps/cli)
npm install
```

### Windows only

Install [Microsoft Edge WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) — usually already present on Windows 10/11.

### macOS only

Xcode Command Line Tools:

```bash
xcode-select --install
```

### Linux only

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

---

## Setup (run once)

### 1. Generate icons

```bash
npm run tauri:icons
```

This reads `public/icons/icon.svg` and writes all required formats to `src-tauri/icons/`.

### 2. Set your deployed URL

The app loads your deployed Cloudflare URL. Update the default in `src-tauri/build.rs`:

```rust
.unwrap_or_else(|_| "https://YOUR_URL.lovable.app".to_string())
```

Or set it as an environment variable when building (see below).

---

## Development (hot reload)

```bash
# Terminal 1 — start the web dev server
npm run dev

# Terminal 2 — launch the Tauri window
npm run tauri:dev
```

The Tauri window loads `http://localhost:5173` with full hot module replacement.

---

## Production build

```bash
# With env var (recommended — no code change needed):
NEXUS_APP_URL=https://your-url.lovable.app npm run tauri:build

# Or edit the default in src-tauri/build.rs and just run:
npm run tauri:build
```

Output installers are in `src-tauri/target/release/bundle/`:
| Platform | File |
|---|---|
| Windows | `nsis/Nexus HQ_1.0.0_x64-setup.exe` |
| macOS | `dmg/Nexus HQ_1.0.0_x64.dmg` |
| Linux | `deb/nexus-hq_1.0.0_amd64.deb` or `AppImage/` |

---

## Features

- **System tray** — app hides to tray when you close the window; click the tray icon to show/hide
- **Single instance** — launching a second copy focuses the existing window
- **Native window** — no browser chrome; own taskbar entry with the Nexus HQ icon
- **Auto URL** — loads your deployed app; the web app handles all auth and Supabase normally

---

## Updating the app

The web app (React/Supabase) auto-updates because it loads from your Cloudflare deployment — no new installer needed. You'd only rebuild the Tauri shell if you change native features (tray, window behaviour, etc.).
