import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { getFirestore, doc, collection, addDoc, onSnapshot, setDoc, query, orderBy, limit, serverTimestamp } from "firebase/firestore";
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
  const historyQuery = query(collection(db, "clipboard", uid, "history"), orderBy("createdAt", "desc"), limit(10));
  unsubscribeHistory = onSnapshot(historyQuery, (snap) => {
    chrome.storage.local.set({ history: snap.docs.map((d) => d.data()) });
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

// Clear the badge whenever the popup opens and acknowledges the message.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "CLEAR_BADGE") {
    chrome.action.setBadgeText({ text: "" });
    sendResponse({ ok: true });
  }

  if (msg.type === "OFFSCREEN_CLIPBOARD_CHANGED") {
    pushClipboard(msg.text, "chrome");
    return;
  }

  if (msg.type === "PUSH_CLIPBOARD") {
    pushClipboard(msg.text, "chrome")
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep the message channel open for the async response
  }
}
);
