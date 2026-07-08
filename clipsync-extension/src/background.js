import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { getFirestore, doc, collection, addDoc, deleteDoc, onSnapshot, setDoc, query, orderBy, limit, serverTimestamp } from "firebase/firestore";
import { FIREBASE_CONFIG, SHARED_ACCOUNT } from "./firebase-config.js";

const app = initializeApp(FIREBASE_CONFIG);
const auth = initializeAuth(app, { persistence: indexedDBLocalPersistence });
const db = getFirestore(app);

let unsubscribe = null;
let currentUid = null;
let unsubscribeHistory = null;
const OFFSCREEN_URL = "offscreen.html";

async function ensureOffscreenDocument() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (existing.length > 0) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["CLIPBOARD"],
    justification: "Read/write the system clipboard to sync with other devices.",
  });
}

async function pushClipboard(text, sourceDevice) {
  if (!currentUid) return { ok: false, error: "Not signed in yet" };
  try {
    await setDoc(doc(db, "clipboard", currentUid), { text, sourceDevice, updatedAt: serverTimestamp() });
    await addDoc(collection(db, "clipboard", currentUid, "history"), { text, sourceDevice, createdAt: serverTimestamp() });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function startListening(uid) {
  if (unsubscribe) unsubscribe();
  unsubscribe = onSnapshot(doc(db, "clipboard", uid), async (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.sourceDevice === "chrome") return; // ignore our own writes

    await ensureOffscreenDocument();
    chrome.runtime.sendMessage({ type: "OFFSCREEN_WRITE", text: data.text });

    chrome.action.setBadgeText({ text: "✓" });
    chrome.action.setBadgeBackgroundColor({ color: "#22C55E" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 3000);

    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon128.png",
      title: `Auto-copied from ${data.sourceDevice}`,
      message: data.text.length > 120 ? data.text.slice(0, 120) + "…" : data.text,
    });
  });

  if (unsubscribeHistory) unsubscribeHistory();
  const historyQuery = query(collection(db, "clipboard", uid, "history"), orderBy("createdAt", "desc"), limit(20));
  unsubscribeHistory = onSnapshot(historyQuery, (snap) => {
    chrome.storage.local.set({ history: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  });
}


async function signIn() {
  const cred = await signInWithEmailAndPassword(
    auth,
    SHARED_ACCOUNT.email,
    SHARED_ACCOUNT.password
  );
  currentUid = cred.user.uid;
  chrome.storage.local.set({ uid: cred.user.uid, signedIn: true });
  await ensureOffscreenDocument();
  startListening(cred.user.uid);
}

signIn().catch((err) => {
  console.error("ClipSync sign-in failed:", err);
  chrome.storage.local.set({ signedIn: false, authError: err.message });
});

// ===== CONTEXT MENU =====
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "clipsync-send",
    title: "Send via ClipSync",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "clipsync-send" && info.selectionText) {
    pushClipboard(info.selectionText, "chrome").then((res) => {
      if (res.ok) {
        chrome.action.setBadgeText({ text: "✓" });
        chrome.action.setBadgeBackgroundColor({ color: "#6366F1" });
        setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);
      }
    });
  }
});

// ===== KEYBOARD SHORTCUT =====
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "send-clipboard") {
    try {
      await ensureOffscreenDocument();
      // Request clipboard text from offscreen document
      chrome.runtime.sendMessage({ type: "OFFSCREEN_READ" }, async (response) => {
        if (response && response.text) {
          const res = await pushClipboard(response.text, "chrome");
          if (res.ok) {
            chrome.action.setBadgeText({ text: "✓" });
            chrome.action.setBadgeBackgroundColor({ color: "#6366F1" });
            setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2000);

            chrome.notifications.create({
              type: "basic",
              iconUrl: "icon128.png",
              title: "Clipboard sent via ClipSync",
              message: response.text.length > 80 ? response.text.slice(0, 80) + "…" : response.text,
            });
          }
        }
      });
    } catch (err) {
      console.error("Keyboard shortcut error:", err);
    }
  }
});

// ===== MESSAGE HANDLER =====
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "CLEAR_BADGE") {
    chrome.action.setBadgeText({ text: "" });
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "OFFSCREEN_CLIPBOARD_CHANGED") {
    pushClipboard(msg.text, "chrome");
    return;
  }

  if (msg.type === "PUSH_CLIPBOARD") {
    pushClipboard(msg.text, "chrome")
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "DELETE_HISTORY") {
    if (!currentUid || !msg.docId) {
      sendResponse({ ok: false, error: "Missing uid or docId" });
      return;
    }
    deleteDoc(doc(db, "clipboard", currentUid, "history", msg.docId))
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
