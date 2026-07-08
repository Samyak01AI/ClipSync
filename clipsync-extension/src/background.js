import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { FIREBASE_CONFIG, SHARED_ACCOUNT } from "./firebase-config.js";

const app = initializeApp(FIREBASE_CONFIG);
const auth = initializeAuth(app, { persistence: indexedDBLocalPersistence });
const db = getFirestore(app);

let unsubscribe = null;
let currentUid = null;

function startListening(uid) {
  if (unsubscribe) unsubscribe();
  unsubscribe = onSnapshot(doc(db, "clipboard", uid), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.sourceDevice === "chrome") return; // ignore our own writes

    // Stash the incoming clipboard text for the popup to read, and
    // badge the toolbar icon so it's obvious something new arrived.
    chrome.storage.local.set({
      incoming: { text: data.text, sourceDevice: data.sourceDevice },
    });
    chrome.action.setBadgeText({ text: "1" });
    chrome.action.setBadgeBackgroundColor({ color: "#4F46E5" });

    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon128.png",
      title: `Clipboard from ${data.sourceDevice}`,
      message: data.text.length > 120 ? data.text.slice(0, 120) + "…" : data.text,
    });
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

  if (msg.type === "PUSH_CLIPBOARD") {
    if (!currentUid) {
      sendResponse({ ok: false, error: "Not signed in yet" });
      return true;
    }
    setDoc(doc(db, "clipboard", currentUid), {
      text: msg.text,
      sourceDevice: "chrome",
      updatedAt: serverTimestamp(),
    })
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep the message channel open for the async response
  }
});
