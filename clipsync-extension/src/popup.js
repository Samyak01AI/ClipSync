const statusEl = document.getElementById("status");
const sendBtn = document.getElementById("sendBtn");
const incomingEl = document.getElementById("incoming");

function renderIncoming(incoming) {
  incomingEl.innerHTML = "";
  if (!incoming) return;
  const box = document.createElement("div");
  box.className = "preview";
  box.textContent = incoming.text;
  const pasteBtn = document.createElement("button");
  pasteBtn.textContent = `← Paste from ${incoming.sourceDevice}`;
  pasteBtn.onclick = async () => {
    await navigator.clipboard.writeText(incoming.text);
    chrome.runtime.sendMessage({ type: "CLEAR_BADGE" });
    pasteBtn.textContent = "Copied ✓";
  };
  incomingEl.appendChild(box);
  incomingEl.appendChild(pasteBtn);
}

async function init() {
  const { signedIn, authError, incoming } = await chrome.storage.local.get([
    "signedIn",
    "authError",
    "incoming",
  ]);

  if (signedIn) {
    statusEl.textContent = "Signed in ✓";
    sendBtn.disabled = false;
  } else if (authError) {
    statusEl.textContent = `Sign-in failed: ${authError}`;
  } else {
    statusEl.textContent = "Signing in…";
  }

  renderIncoming(incoming);
}

sendBtn.onclick = async () => {
  try {
    const text = await navigator.clipboard.readText();
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending…";
    const res = await chrome.runtime.sendMessage({ type: "PUSH_CLIPBOARD", text });
    sendBtn.textContent = res.ok ? "Sent ✓" : `Failed: ${res.error}`;
  } catch (err) {
    sendBtn.textContent = `Error: ${err.message}`;
  } finally {
    setTimeout(() => {
      sendBtn.disabled = false;
      sendBtn.textContent = "Send my clipboard →";
    }, 1500);
  }
};

init();
