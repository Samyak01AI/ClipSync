# ⚡ ClipSync — Clipboard Sync Across Devices

> Copy on your phone, paste on your PC. Copy on your PC, paste on your phone. **Instantly.**

ClipSync is a cross-device clipboard sync tool that connects your **Android phone** and **Chrome browser** in real-time using Firebase.

---

## 📸 Features

| Feature | Description |
|---|---|
| 🔄 **Real-time Sync** | Clipboard content syncs instantly between Android & Chrome |
| 🔐 **User Accounts** | Sign up / Sign in — your clips are private to your account |
| 📋 **Clipboard History** | View your last 20 synced clips |
| 📌 **Pinned Clips** | Pin frequently-used clips for quick access |
| 🔍 **Search** | Filter through clipboard history instantly |
| 🗑️ **Delete** | Remove individual clips from history |
| 🌙 **Dark / Light Mode** | Auto-detects OS theme, manual toggle available |
| 🖱️ **Right-Click Menu** | Select text → right-click → "Send via ClipSync" |
| ⌨️ **Keyboard Shortcut** | `Ctrl+Shift+S` to send clipboard instantly |
| 🔗 **URL Detection** | Auto-detects links and shows domain previews |
| 📱💻 **Device Badges** | See which device each clip came from |
| 🔔 **Notifications** | Get notified when a clip arrives from another device |

---

## 🚀 Installation

### 💻 Chrome Extension (PC/Mac/Linux)

1. **Download** `clipsync-chrome-extension.zip` from the [Assets section below](#assets)
2. **Extract** the zip file to a folder on your computer
3. Open Chrome and go to `chrome://extensions`
4. **Enable** "Developer mode" (toggle in the top-right corner)
5. Click **"Load unpacked"**
6. Select the **extracted folder** (the one containing `manifest.json`)
7. ✅ ClipSync icon appears in your toolbar!

### 📱 Android App

1. **Download** `app-debug.apk` from the [Assets section below](#assets)
2. Open the APK on your phone
3. If prompted, tap **"Install anyway"** (you may need to allow installs from unknown sources in Settings)
4. Open ClipSync app
5. ✅ You're ready!

---

## 🔗 How to Connect Your Devices

Both devices need to use the **same account** to sync:

### First Time Setup:
1. Open ClipSync on **either** device (Chrome extension or Android app)
2. Click/tap **"Create one"** to make a new account
3. Enter your **email** and a **password** (min 6 characters)
4. On your **other device**, open ClipSync and **Sign In** with the **same email & password**
5. 🎉 **Done!** Your devices are now linked

### Everyday Use:

#### 📱 → 💻 Phone to PC:
1. **Copy** any text on your phone (from WhatsApp, browser, notes, etc.)
2. Open the ClipSync app → tap **"Send Clipboard to PC"**
3. On your PC, just press **Ctrl+V** — the text is already in your clipboard!

#### 💻 → 📱 PC to Phone:
1. **Copy** any text on your PC
2. Do one of these:
   - Click the ClipSync extension → **"Send my clipboard"**
   - **Right-click** selected text → **"Send via ClipSync"**
   - Press **Ctrl+Shift+S**
3. Your phone gets a notification — the text is in your phone's clipboard!

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| Chrome Extension | JavaScript, Firebase Auth & Firestore, esbuild |
| Android App | Kotlin, Firebase Auth & Firestore, Accessibility Service |
| Backend | Firebase (Firestore real-time database) |
| Auth | Firebase Email/Password Authentication |

---

## 🔒 Privacy & Security

- ✅ Each user has their own isolated data (per-account Firestore rules)
- ✅ Clipboard data is only synced when you explicitly send it
- ✅ No tracking, no ads, no third-party data sharing
- ✅ You can delete your clipboard history anytime
- ✅ Open source — inspect the code yourself

---

## 📁 Project Structure

```
ClipSync/
├── clipsync-extension/          # Chrome Extension
│   ├── src/
│   │   ├── background.js        # Service worker (Firebase sync)
│   │   ├── popup.html           # Extension popup UI
│   │   ├── popup.js             # Popup logic
│   │   ├── offscreen.js         # Clipboard read/write helper
│   │   └── firebase-config.js   # Firebase configuration
│   ├── dist/                    # Built extension (load this in Chrome)
│   ├── manifest.json
│   └── build.js                 # esbuild bundler
│
├── clipsync-android/            # Android App
│   └── app/src/main/
│       ├── java/.../
│       │   ├── MainActivity.kt              # Main UI + Auth
│       │   ├── ClipSyncAccessibilityService.kt  # Background sync
│       │   └── FirebaseConfig.kt            # Firebase config
│       └── res/layout/
│           └── activity_main.xml            # App layout
│
└── README.md
```

---

## 🏗️ Building from Source

### Chrome Extension:
```bash
cd clipsync-extension
npm install
npm run build
# Load the dist/ folder in chrome://extensions
```

### Android App:
1. Open `clipsync-android/` in Android Studio
2. Sync Gradle
3. Build → Run on your device

---

## 📄 License

This project is open source. Feel free to fork, modify, and use it.

---

**Made with ❤️ by [Samyak](https://github.com/Samyak01AI)**
