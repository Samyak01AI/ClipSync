(() => {
  // src/offscreen.js
  var lastRemoteText = null;
  var lastKnownLocal = null;
  var initialized = false;
  async function pollClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!initialized) {
        lastKnownLocal = text;
        initialized = true;
        return;
      }
      if (text === lastKnownLocal) return;
      lastKnownLocal = text;
      if (text === lastRemoteText) return;
      if (!text || !text.trim()) return;
      chrome.runtime.sendMessage({ type: "OFFSCREEN_CLIPBOARD_CHANGED", text });
    } catch (err) {
    }
  }
  setInterval(pollClipboard, 1500);
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "OFFSCREEN_WRITE") {
      lastRemoteText = msg.text;
      lastKnownLocal = msg.text;
      navigator.clipboard.writeText(msg.text).then(() => sendResponse({ ok: true })).catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    }
  });
})();
