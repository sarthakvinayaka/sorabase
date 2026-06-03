# Sorabase Desktop

Granola-style system audio capture for macOS and Windows.  
Captures whatever plays through your speakers — no meeting bot, no browser tab.

## How it works

| Step | What happens |
|---|---|
| 1 | Electron tray app loads in the menu bar |
| 2 | User clicks Start — picks mode (General / Recruiter / Study) |
| 3 | `setDisplayMediaRequestHandler` intercepts `getDisplayMedia()` and injects `audio:'loopback'` — on macOS this uses ScreenCaptureKit, on Windows WASAPI loopback |
| 4 | MediaRecorder chunks audio every 10 s, sends to main process |
| 5 | On Stop, main assembles chunks → multipart POST to `/api/extension/upload` |
| 6 | Whisper transcribes, Sorabase runs extraction, opens review page |

## Requirements

- **macOS 13+ Ventura** (ScreenCaptureKit) or **Windows 10+** (WASAPI loopback)
- Node.js 20+
- Screen Recording permission granted to the app (macOS only)
- Signed in to Sorabase at sorabase.org

## Development

```bash
cd desktop
npm install
npm run dev        # build + launch Electron
```

## Build for distribution

Use [electron-builder](https://www.electron.build/) or [electron-forge](https://www.electronforge.io/) to package.  
Add to `package.json`:

```json
"build": {
  "appId": "org.sorabase.desktop",
  "mac": { "category": "public.app-category.productivity" },
  "win": { "target": "nsis" }
}
```

## Environment

Set `SORABASE_URL` to point at a self-hosted instance.  
Defaults to `https://www.sorabase.org`.
