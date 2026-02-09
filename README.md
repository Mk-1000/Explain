# AI Text Enhancer

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

```bash
npm run package        # current platform
npm run package:win
npm run package:mac
npm run package:linux
```

Output is in `release/`.

## Features

- **Global shortcut**: Default `Ctrl+Shift+Space` / `Cmd+Shift+Space` to capture selected text and open the popup.
- **AI providers**: OpenAI, OpenRouter, Anthropic, Ollama (local). Configure API keys and priority in Settings → AI Providers.
- **Enhancement types**: Grammar, rephrase, formal, casual, concise, expand (configurable default).
- **Replace / Copy**: Replace pastes the suggestion and closes the popup; Copy writes to clipboard.
- **History**: Optional history of enhancements (enable in Preferences).
- **Privacy**: Sensitive-data detection and excluded-app list.

## Project structure

- `src/main/` – Electron main process (windows, services, AI providers, IPC).
- `src/renderer/` – React UI (popup + settings), hooks, components.
- `src/preload/` – Preload script (context bridge).
- `src/shared/` – Shared types and constants.

## Requirements

- **robotjs**: For text selection (simulated Ctrl/C) and paste (Ctrl+V). On Linux you may need: `libxtst-dev`, `libpng++-dev`.

## Notes on `npm install`

**Deprecation warnings**  
Most come from transitive dependencies (e.g. electron-builder, npm’s own tooling). They don’t affect how the app runs. Upstream packages need to update their dependencies; you can ignore these for local development.

**Vulnerabilities (`npm audit`)**  
Current versions are pinned for compatibility. To reduce reported issues when you’re ready to upgrade:

- **Electron** (moderate, ASAR): Upgrade to `electron@^35.7.5` or newer.
- **electron-builder / tar** (high, in packaging tooling): Upgrade to `electron-builder@^26.7.0` (prefers Node 22+).
- **Vite / esbuild** (moderate, dev server only): Fixed in Vite 7+; only affects `npm run dev`, not production builds.

After upgrading, run `npm audit` again. Using `npm audit fix --force` can introduce breaking changes; prefer upgrading the packages above explicitly.
