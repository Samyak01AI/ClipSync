const statusEl = document.getElementById("status");
const sendBtn = document.getElementById("sendBtn");
const historyEl = document.getElementById("history");

function timeAgo(ts) {
  if (!ts || !ts.seconds) return "";
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000 - ts.seconds));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function renderHistory(items) {
  historyEl.innerHTML = "";
  if (!items || items.length === 0) {
    historyEl.innerHTML = '<div class="empty">Nothing synced yet.</div>';
    return;
  }
  for (const item of items) {
    const el = document.createElement("div");
    el.className = "history-item";
    el.textContent = item.text;
    const meta = document.createElement("div");
    meta.className = "history-meta";
    meta.textContent = `${item.sourceDevice} · ${timeAgo(item.createdAt)}`;
    el.appendChild(meta);
    el.onclick = async () => {
      await navigator.clipboard.writeText(item.text);
      el.style.background = "#dcfce7";
      setTimeout(() => (el.style.background = ""), 400);
    };
    historyEl.appendChild(el);
  }
}

async function init() {
  const { signedIn, authError, history } = await chrome.storage.local.get([
    "signedIn",
    "authError",
    "history",
  ]);

  if (signedIn) {
    statusEl.textContent = "Signed in ✓ — syncing automatically";
    sendBtn.disabled = false;
  } else if (authError) {
    statusEl.textContent = `Sign-in failed: ${authError}`;
  } else {
    statusEl.textContent = "Signing in…";
  }

  renderHistory(history);
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

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.signedIn || changes.authError) init();
  if (changes.history) renderHistory(changes.history.newValue);
});