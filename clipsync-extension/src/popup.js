// ===== DOM REFS =====
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const sendBtn = document.getElementById("sendBtn");
const sendLabel = document.getElementById("sendLabel");
const allPanel = document.getElementById("allPanel");
const pinnedPanel = document.getElementById("pinnedPanel");
const searchBar = document.getElementById("searchBar");
const searchInput = document.getElementById("searchInput");
const searchToggle = document.getElementById("searchToggle");
const themeToggle = document.getElementById("themeToggle");
const allCount = document.getElementById("allCount");
const pinnedCount = document.getElementById("pinnedCount");
const toast = document.getElementById("toast");
const tabs = document.querySelectorAll(".tab");

let currentHistory = [];
let pinnedItems = [];
let activeTab = "all";
let searchQuery = "";

// ===== THEME =====
function initTheme() {
  const saved = localStorage.getItem("clipsync-theme");
  if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.setAttribute("data-theme", "dark");
    themeToggle.textContent = "☀️";
  } else {
    themeToggle.textContent = "🌙";
  }
}

themeToggle.onclick = () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  if (isDark) {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("clipsync-theme", "light");
    themeToggle.textContent = "🌙";
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("clipsync-theme", "dark");
    themeToggle.textContent = "☀️";
  }
};

initTheme();

// ===== SEARCH =====
searchToggle.onclick = () => {
  searchBar.classList.toggle("visible");
  if (searchBar.classList.contains("visible")) {
    searchInput.focus();
  } else {
    searchInput.value = "";
    searchQuery = "";
    renderCurrentTab();
  }
};

searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value.toLowerCase().trim();
  renderCurrentTab();
});

// ===== TABS =====
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    activeTab = tab.dataset.tab;
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    document.getElementById(activeTab + "Panel").classList.add("active");
    renderCurrentTab();
  });
});

// ===== HELPERS =====
function timeAgo(ts) {
  if (!ts || !ts.seconds) return "";
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000 - ts.seconds));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function isUrl(text) {
  try {
    const trimmed = text.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      new URL(trimmed);
      return true;
    }
    if (/^[\w-]+\.[\w.-]+/.test(trimmed) && trimmed.includes(".")) {
      new URL("https://" + trimmed);
      return true;
    }
  } catch {}
  return false;
}

function getDomain(text) {
  try {
    const url = text.trim().startsWith("http") ? new URL(text.trim()) : new URL("https://" + text.trim());
    return url.hostname.replace(/^www\./, "");
  } catch {
    return text.trim().substring(0, 30);
  }
}

function showToast(msg, duration = 2000) {
  toast.textContent = msg;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), duration);
}

function isPinned(text) {
  return pinnedItems.some((p) => p.text === text);
}

async function togglePin(text, sourceDevice, createdAt) {
  if (isPinned(text)) {
    pinnedItems = pinnedItems.filter((p) => p.text !== text);
    showToast("Unpinned ✓");
  } else {
    pinnedItems.push({ text, sourceDevice, createdAt, pinned: true });
    showToast("Pinned ✓");
  }
  await chrome.storage.local.set({ pinnedItems });
  updateCounts();
  renderCurrentTab();
}

function updateCounts() {
  const filtered = filterItems(currentHistory);
  allCount.textContent = filtered.length;
  pinnedCount.textContent = filterItems(pinnedItems).length;
}

function filterItems(items) {
  if (!searchQuery) return items || [];
  return (items || []).filter((item) => item.text && item.text.toLowerCase().includes(searchQuery));
}

// ===== RENDER =====
function renderItems(container, items, showPinAction = true) {
  container.innerHTML = "";
  const filtered = filterItems(items);

  if (!filtered || filtered.length === 0) {
    const emptyType = activeTab === "pinned" ? "pinned" : "history";
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${emptyType === "pinned" ? "📌" : "📋"}</div>
        <div class="empty-title">${emptyType === "pinned" ? "No pinned clips" : (searchQuery ? "No results found" : "Nothing synced yet")}</div>
        <div class="empty-desc">${
          emptyType === "pinned"
            ? "Hover over a clip and click the pin icon to keep it handy."
            : searchQuery
            ? "Try a different search term."
            : "Copy something and send it, or wait for clips from your other devices."
        }</div>
      </div>
    `;
    return;
  }

  for (const item of filtered) {
    const el = document.createElement("div");
    el.className = "clip-item";

    const urlCheck = isUrl(item.text);

    // Clip text
    const textEl = document.createElement("div");
    textEl.className = "clip-text" + (urlCheck ? " url-text" : "");
    textEl.textContent = item.text;
    el.appendChild(textEl);

    // URL preview
    if (urlCheck) {
      const preview = document.createElement("div");
      preview.className = "clip-url-preview";
      preview.innerHTML = `<span>🔗</span><span class="domain">${getDomain(item.text)}</span>`;
      el.appendChild(preview);
    }

    // Meta row
    const meta = document.createElement("div");
    meta.className = "clip-meta";

    const info = document.createElement("div");
    info.className = "clip-info";

    const device = item.sourceDevice || "unknown";
    const badgeClass = device === "chrome" ? "chrome" : device === "android" ? "android" : "unknown";
    const deviceIcon = device === "chrome" ? "💻" : device === "android" ? "📱" : "❓";

    info.innerHTML = `
      <span class="device-badge ${badgeClass}">${deviceIcon} ${device}</span>
      <span>${timeAgo(item.createdAt)}</span>
    `;
    meta.appendChild(info);

    // Action buttons
    const actions = document.createElement("div");
    actions.className = "clip-actions";

    // Copy button
    const copyBtn = document.createElement("button");
    copyBtn.className = "clip-action-btn";
    copyBtn.title = "Copy to clipboard";
    copyBtn.textContent = "📋";
    copyBtn.onclick = async (e) => {
      e.stopPropagation();
      await navigator.clipboard.writeText(item.text);
      el.classList.add("copied");
      showToast("Copied to clipboard ✓");
      setTimeout(() => el.classList.remove("copied"), 600);
    };
    actions.appendChild(copyBtn);

    // Pin button
    if (showPinAction) {
      const pinBtn = document.createElement("button");
      const pinned = isPinned(item.text);
      pinBtn.className = "clip-action-btn" + (pinned ? " pinned pin-visible" : "");
      pinBtn.title = pinned ? "Unpin" : "Pin this clip";
      pinBtn.textContent = pinned ? "📌" : "📍";
      pinBtn.onclick = (e) => {
        e.stopPropagation();
        togglePin(item.text, item.sourceDevice, item.createdAt);
      };
      actions.appendChild(pinBtn);
    }

    // Delete from pinned
    if (activeTab === "pinned") {
      const removeBtn = document.createElement("button");
      removeBtn.className = "clip-action-btn";
      removeBtn.title = "Unpin";
      removeBtn.textContent = "✕";
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        togglePin(item.text);
      };
      actions.appendChild(removeBtn);
    }

    meta.appendChild(actions);
    el.appendChild(meta);

    // Click to copy
    el.onclick = async () => {
      await navigator.clipboard.writeText(item.text);
      el.classList.add("copied");
      showToast("Copied to clipboard ✓");
      setTimeout(() => el.classList.remove("copied"), 600);
    };

    container.appendChild(el);
  }
}

function renderCurrentTab() {
  if (activeTab === "all") {
    renderItems(allPanel, currentHistory, true);
  } else {
    renderItems(pinnedPanel, pinnedItems, false);
  }
  updateCounts();
}

// ===== INIT =====
async function init() {
  const { signedIn, authError, history, pinnedItems: savedPins } = await chrome.storage.local.get([
    "signedIn",
    "authError",
    "history",
    "pinnedItems",
  ]);

  if (signedIn) {
    statusText.textContent = "Connected";
    statusDot.classList.add("connected");
    sendBtn.disabled = false;
  } else if (authError) {
    statusText.textContent = `Error: ${authError}`;
    statusDot.classList.add("error");
  } else {
    statusText.textContent = "Connecting…";
  }

  currentHistory = history || [];
  pinnedItems = savedPins || [];
  renderCurrentTab();
}

// ===== SEND =====
sendBtn.onclick = async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text || !text.trim()) {
      showToast("Clipboard is empty");
      return;
    }
    sendBtn.disabled = true;
    sendLabel.textContent = "Sending…";
    const res = await chrome.runtime.sendMessage({ type: "PUSH_CLIPBOARD", text });
    if (res.ok) {
      sendLabel.textContent = "Sent ✓";
      showToast("Clipboard sent to your devices ✓");
    } else {
      sendLabel.textContent = `Failed: ${res.error}`;
      showToast("Failed to send: " + res.error);
    }
  } catch (err) {
    sendLabel.textContent = `Error`;
    showToast("Error: " + err.message);
  } finally {
    setTimeout(() => {
      sendBtn.disabled = false;
      sendLabel.textContent = "Send my clipboard";
    }, 1500);
  }
};

init();

// ===== LIVE UPDATES =====
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.signedIn || changes.authError) init();
  if (changes.history) {
    currentHistory = changes.history.newValue || [];
    renderCurrentTab();
  }
  if (changes.pinnedItems) {
    pinnedItems = changes.pinnedItems.newValue || [];
    renderCurrentTab();
  }
});

// Clear badge when popup opens
chrome.runtime.sendMessage({ type: "CLEAR_BADGE" }).catch(() => {});