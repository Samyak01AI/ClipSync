# ClipSync — Chrome Extension

## Setup
1. Fill in `src/firebase-config.js` with your Firebase project's web
   config and the shared account credentials (see
   `clipboard-sync-schema.md` for how the account is used).
2. Rebuild:
   ```
   npm run build
   ```
   (Re-run this every time you edit anything in `src/`.)
3. Load it in Chrome:
   - Go to `chrome://extensions`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked** → select the `dist/` folder
4. Click the ClipSync icon in the toolbar. It should say "Signed in ✓"
   within a second or two.

## Using it
- **Send my clipboard →**: pushes whatever's currently on your PC
  clipboard to Firestore, tagged `sourceDevice: "chrome"`.
- When another device (phone) pushes new clipboard content, the
  toolbar icon gets a badge and you get a desktop notification. Open
  the popup and click **← Paste from android/ios** to copy it into
  your PC clipboard.

## Known limitation (by design)
Chrome extensions can't read/write the system clipboard silently in
the background — every read/write happens from the popup, which
requires an actual click. This is a Chrome security restriction, not
a bug: it's the same reason a random webpage can't read your
clipboard without you interacting with it.

## Security note
The shared account's email/password lives in plaintext inside
`src/firebase-config.js` (and gets bundled into `dist/background.bundle.js`).
That's fine for a personal, local-only extension you're not
distributing, but don't publish this to the Chrome Web Store as-is —
you'd want to swap to a proper per-device auth flow first.
