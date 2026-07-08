# ClipSync ⚡

**Instantly sync your clipboard between Android and Chrome — no wires, no fuss.**

Copy on your phone, paste on your PC. Copy on your PC, paste on your phone. It just works.

---

## ✨ Features

| Feature | Description |
|---|---|
| **🔄 Real-time Sync** | Clipboard changes sync instantly via Firebase |
| **📱 Android ↔ Chrome** | Full bidirectional clipboard sync |
| **📋 Clipboard History** | Browse your last 20 synced clips with timestamps |
| **📌 Pinned Clips** | Star frequently-used clips for quick access |
| **🔍 Search** | Search through your clipboard history instantly |
| **🖱️ Right-Click Menu** | Select text → right-click → "Send via ClipSync" |
| **⌨️ Keyboard Shortcut** | `Ctrl+Shift+S` to send clipboard without opening popup |
| **🌙 Dark Mode** | Gorgeous dark/light theme with auto-detection |
| **🔗 URL Detection** | Smart URL preview cards for link clips |
| **🔔 Notifications** | Get notified when a clip arrives from another device |
| **📊 Device Badges** | See which device each clip came from |

---

## 🚀 Quick Start

### Chrome Extension

1. **Clone & install**
   ```bash
   cd clipsync-extension
   npm install
   ```

2. **Configure Firebase** — edit `src/firebase-config.js` with your Firebase project credentials

3. **Build**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" → select the `dist/` folder

### Android App

1. Open `clipsync-android/` in Android Studio
2. Add your `google-services.json` from Firebase console
3. Update credentials in `FirebaseConfig.kt` to match
4. Build and install on your device
5. Enable the ClipSync accessibility service when prompted

---

## 🏗️ Architecture

```
┌──────────────┐     Firebase Firestore     ┌──────────────────┐
│  Chrome Ext  │ ◄═══════════════════════► │  Android App     │
│              │                            │                  │
│  popup.js    │    /clipboard/{uid}         │  Accessibility   │
│  background  │    /clipboard/{uid}/history │  Service         │
│  offscreen   │                            │                  │
└──────────────┘                            └──────────────────┘
```

- **Chrome Extension**: MV3 service worker + offscreen document for clipboard access
- **Android App**: Accessibility service for background clipboard monitoring
- **Firebase**: Firestore for real-time data sync, Auth for device linking

---

## 📁 Project Structure

```
clipsync/
├── clipsync-extension/
│   ├── src/
│   │   ├── background.js      # Service worker: Firebase sync, context menu, shortcuts
│   │   ├── popup.js            # Popup UI: history, search, pins, themes
│   │   ├── popup.html          # Premium dark/light popup design
│   │   ├── offscreen.js        # Clipboard read/write in offscreen document
│   │   └── firebase-config.js  # Firebase credentials
│   ├── manifest.json           # Extension manifest (MV3)
│   ├── firestore.rules         # Security rules for Firestore
│   └── dist/                   # Built extension (load this in Chrome)
│
└── clipsync-android/
    └── app/src/main/java/com/samyak/clipsync/
        ├── MainActivity.kt                 # Main UI
        ├── ClipSyncAccessibilityService.kt  # Background clipboard sync
        └── FirebaseConfig.kt               # Shared auth credentials
```

---

## 🛡️ Security

- Firebase Auth ensures only your devices can access your clipboard data
- Firestore rules enforce owner-only access to clipboard documents
- History subcollection is protected with the same user-scoped rules

---

## 📄 License

MIT

---

**Made with ❤️ by Samyak**
