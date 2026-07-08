(() => {
  // src/popup.js
  var statusEl = document.getElementById("status");
  var sendBtn = document.getElementById("sendBtn");
  var incomingEl = document.getElementById("incoming");
  function renderIncoming(incoming) {
    incomingEl.innerHTML = "";
    if (!incoming) return;
    const box = document.createElement("div");
    box.className = "preview";
    box.textContent = incoming.text;
    const pasteBtn = document.createElement("button");
    pasteBtn.textContent = `\u2190 Paste from ${incoming.sourceDevice}`;
    pasteBtn.onclick = async () => {
      await navigator.clipboard.writeText(incoming.text);
      chrome.runtime.sendMessage({ type: "CLEAR_BADGE" });
      pasteBtn.textContent = "Copied \u2713";
    };
    incomingEl.appendChild(box);
    incomingEl.appendChild(pasteBtn);
  }
  async function init() {
    const { signedIn, authError, incoming } = await chrome.storage.local.get([
      "signedIn",
      "authError",
      "incoming"
    ]);
    if (signedIn) {
      statusEl.textContent = "Signed in \u2713";
      sendBtn.disabled = false;
    } else if (authError) {
      statusEl.textContent = `Sign-in failed: ${authError}`;
    } else {
      statusEl.textContent = "Signing in\u2026";
    }
    renderIncoming(incoming);
  }
  sendBtn.onclick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      sendBtn.disabled = true;
      sendBtn.textContent = "Sending\u2026";
      const res = await chrome.runtime.sendMessage({ type: "PUSH_CLIPBOARD", text });
      sendBtn.textContent = res.ok ? "Sent \u2713" : `Failed: ${res.error}`;
    } catch (err) {
      sendBtn.textContent = `Error: ${err.message}`;
    } finally {
      setTimeout(() => {
        sendBtn.disabled = false;
        sendBtn.textContent = "Send my clipboard \u2192";
      }, 1500);
    }
  };
  init();
})();
