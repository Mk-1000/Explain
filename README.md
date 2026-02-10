# WriteUp

Desktop app that enhances selected text using AI. Select text anywhere, press **Ctrl+Shift+Space** (or **Cmd+Shift+Space** on Mac), and get suggestions to replace or copy.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

- Starts Vite on http://localhost:5173 and Electron once Vite is ready.
- **Settings window**: Shown when the app starts (or via second instance). Configure AI providers, shortcut, and preferences.
- **Popup**: Triggered by the global shortcut after selecting text.

## Build

```bash
npm run build
```

Then run with:

```bash
npx electron .
```

## Package (installers)

### Production Builds

Build production installers for different platforms:

```bash
# Build for current platform
npm run package

# Build for Windows (from any platform)
npm run package:win

# Build for Linux (from any platform)
npm run package:linux

# Build for macOS (from macOS only)
npm run package:mac
```

**Output:** Installers are created in the `release/` directory.

### Platform-Specific Details

#### Windows
- Creates **NSIS installer** (`.exe`) - full installer with uninstaller
- Creates **Portable** (`.exe`) - standalone executable, no installation needed
- Icons: Requires `assets/logo.ico` (256x256 recommended)

#### Linux
- Creates **AppImage** (`.AppImage`) - portable, no installation needed
- Creates **Debian package** (`.deb`) - for Debian/Ubuntu-based systems
- Icons: Requires `assets/logo.png` (512x512 recommended)
- Category: Utility

#### macOS
- Creates **DMG** (`.dmg`) - disk image for distribution
- Creates **ZIP** (`.zip`) - compressed app bundle
- Icons: Requires `assets/logo.png` (electron-builder converts PNG to ICNS automatically)
- **Note:** macOS builds must be done on macOS due to code signing requirements

### Building from Linux for Windows

To build Windows installers from Linux, you need:

1. **Install Wine** (for Windows build tools):
   ```bash
   # Ubuntu/Debian
   sudo apt-get install wine64 wine32
   
   # Fedora
   sudo dnf install wine
   ```

2. **Build Windows installer**:
   ```bash
   npm run package:win
   ```

   Electron-builder will automatically download Windows build tools via Wine.

### Building from Windows for Linux

To build Linux installers from Windows:

1. **Install WSL** (Windows Subsystem for Linux) or use a Linux VM

2. **Or use Docker** (recommended):
   ```bash
   # Build Linux AppImage using Docker
   docker run --rm -v ${PWD}:/project -w /project electronuserland/builder:wine bash -c "npm run package:linux"
   ```

### Production Build Checklist

Before building for production:

- [ ] Update version in `package.json`
- [ ] Ensure all icons exist (`assets/logo.ico`, `assets/logo.png`)
- [ ] Test the app thoroughly (`npm run build && npx electron .`)
- [ ] Verify all dependencies are included
- [ ] Check that native modules (if any) are properly bundled

### Troubleshooting Build Issues

**Missing icons:**
- Create icon files in `assets/` directory
- Windows: `logo.ico` format (use online converter or ImageMagick)
- Linux: `logo.png` format (512x512px recommended)
- macOS: `logo.png` format (electron-builder converts PNG to ICNS automatically, or use `iconutil` on macOS)

**Build fails with "wine not found":**
- Install Wine: `sudo apt-get install wine64 wine32` (Linux)
- Or build Windows installers on Windows/macOS

**Large build size:**
- This is normal for Electron apps (includes Chromium + Node.js)
- Windows: ~150-200MB
- Linux: ~100-150MB
- macOS: ~150-200MB

## Features

- **Global shortcut**: Default `Ctrl+Shift+Space` / `Cmd+Shift+Space` to capture selected text and open the popup.
- **AI providers**: OpenAI, OpenRouter, Anthropic, Ollama (local). Configure API keys and priority in Settings → AI Providers.
- **Enhancement types**: Grammar, rephrase, formal, casual, concise, expand (configurable default).
- **Replace / Copy**: Replace pastes the suggestion and closes the popup; Copy writes to clipboard.
- **Diff view**: Toggle diff view to see word-level changes between original and enhanced text with statistics.
- **History**: Optional history of enhancements (enable in Preferences).
- **Privacy**: Sensitive-data detection and excluded-app list.
- **Cross-platform**: Native Electron APIs for better Linux/Windows/Mac compatibility (no RobotJS dependency).
- **Error handling**: Automatic fallback between providers with detailed error reporting.

## Project structure

- `src/main/` – Electron main process (windows, services, AI providers, IPC).
- `src/renderer/` – React UI (popup + settings), hooks, components.
- `src/preload/` – Preload script (context bridge).
- `src/shared/` – Shared types and constants.

## Requirements

- **Node.js** 18+ and npm
- **No native dependencies**: Uses Electron's native APIs for clipboard and cursor position. Paste simulation uses platform-specific tools (xdotool on Linux, osascript on macOS, PowerShell on Windows) if available, but manual paste (Ctrl+V / Cmd+V) always works.

**Keyboard shortcut:** Select text first or copy text to the clipboard, then press the shortcut. The app reads from clipboard as the primary method for better cross-platform compatibility.

## Linux: Electron sandbox

If Electron fails to start with a sandbox error (`chrome-sandbox` / SUID), either:

- **Option A:** Run with the sandbox disabled (development only):  
  `npm run dev:linux`
- **Option B:** Fix permissions once (then use `npm run dev` as usual):  
  `sudo chown root node_modules/electron/dist/chrome-sandbox`  
  `sudo chmod 4755 node_modules/electron/dist/chrome-sandbox`

## Notes on `npm install`

**Deprecation warnings**  
Most come from transitive dependencies (e.g. electron-builder, npm’s own tooling). They don’t affect how the app runs. Upstream packages need to update their dependencies; you can ignore these for local development.

**Vulnerabilities (`npm audit`)**  
Current versions are pinned for compatibility. To reduce reported issues when you’re ready to upgrade:

- **Electron** (moderate, ASAR): Upgrade to `electron@^35.7.5` or newer.
- **electron-builder / tar** (high, in packaging tooling): Upgrade to `electron-builder@^26.7.0` (prefers Node 22+).
- **Vite / esbuild** (moderate, dev server only): Fixed in Vite 7+; only affects `npm run dev`, not production builds.

After upgrading, run `npm audit` again. Using `npm audit fix --force` can introduce breaking changes; prefer upgrading the packages above explicitly.
