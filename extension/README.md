# SoraBase Capture — Chrome Extension

A Manifest V3 Chrome extension that captures browser meeting audio and sends it to SoraBase for structured AI extraction.

## Architecture

```
extension/
  manifest.json           MV3 manifest — permissions, host_permissions, content scripts
  background/sw.js        Service worker — orchestrates recording, uploads audio
  offscreen/
    offscreen.html        Offscreen document host page
    offscreen.js          MediaRecorder + Web Audio API mixing (tab + mic)
  popup/
    popup.html            Extension popup UI
    popup.js              Popup logic — auth check, meeting detection, start/stop
    popup.css             Styles matching SoraBase design language
  content/
    indicator.js          Recording badge injected into meeting tabs
    indicator.css         Badge styles
    bridge.js             Injected into SoraBase pages — postMessage bridge
  icons/                  PNG icons (see below)
```

## Icon setup

Chrome extensions require PNG icons. Create icons in these sizes:

```
icons/icon16.png    16×16
icons/icon48.png    48×48
icons/icon128.png   128×128
```

Use the SoraBase aubergine color palette (#3a1828 on white).
A simple circle or the SoraBase logomark works well.

Generate with ImageMagick:
```bash
convert -size 128x128 xc:"#fafaf9" -fill "#3a1828" \
  -draw "circle 64,64 64,20" icons/icon128.png
magick icons/icon128.png -resize 48x48 icons/icon48.png
magick icons/icon128.png -resize 16x16 icons/icon16.png
```

## Development setup

1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `extension/` directory
4. The extension appears in the toolbar

## How it works

### Recording flow

1. User opens the extension popup on a meeting tab (Google Meet, Zoom, Teams)
2. Popup calls `chrome.tabCapture.getMediaStreamId()` (must be in popup for user gesture)
3. Stream ID is sent to the service worker
4. Service worker creates the offscreen document
5. Offscreen document captures tab audio via `getUserMedia` with the stream ID
6. Optionally mixes in microphone audio via Web Audio API
7. `MediaRecorder` records mixed audio in 10-second chunks
8. On stop: chunks are assembled into a `.webm` file
9. Audio is uploaded to SoraBase via `POST /api/audio` (uses the user's session cookie)
10. SoraBase returns a `conversation_id`
11. Extension opens the appropriate SoraBase page (schema editor for General Mode)

### Authentication

The extension reuses the user's existing SoraBase session cookies.
The Next.js proxy at `/api/[...path]/route.ts` handles session validation and HMAC computation transparently.
No separate extension API key is needed.

### Extension ↔ SoraBase app communication

The bridge content script (`content/bridge.js`) is injected into SoraBase pages.
It uses `postMessage` to relay recording state to the web app.
The web app's `useExtensionStatus` hook subscribes to these messages.

## Supported meeting platforms

- Google Meet (`meet.google.com`)
- Zoom web client (`*.zoom.us/wc/*`)
- Microsoft Teams (`teams.microsoft.com`, `app.teams.microsoft.com`)
- Any browser tab with audio output

## Privacy & consent

- Recording only starts on explicit user action (clicking "Start capture")
- A visible recording indicator is shown on the meeting tab
- Popup includes a consent reminder
- Audio is sent only to the user's SoraBase instance
- No audio is stored by the extension beyond the current recording session
