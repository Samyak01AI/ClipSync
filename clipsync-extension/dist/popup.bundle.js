(() => {
  // src/popup.js
  var statusDot = document.getElementById("statusDot");
  var statusText = document.getElementById("statusText");
  var sendBtn = document.getElementById("sendBtn");
  var sendLabel = document.getElementById("sendLabel");
  var allPanel = document.getElementById("allPanel");
  var pinnedPanel = document.getElementById("pinnedPanel");
  var searchBar = document.getElementById("searchBar");
  var searchInput = document.getElementById("searchInput");
  var searchToggle = document.getElementById("searchToggle");
  var themeToggle = document.getElementById("themeToggle");
  var allCount = document.getElementById("allCount");
  var pinnedCount = document.getElementById("pinnedCount");
  var toast = document.getElementById("toast");
  var tabs = document.querySelectorAll(".tab");
  var authScreen = document.getElementById("authScreen");
  var appScreen = document.getElementById("appScreen");
  var authTitle = document.getElementById("authTitle");
  var authEmail = document.getElementById("authEmail");
  var authPassword = document.getElementById("authPassword");
  var authBtn = document.getElementById("authBtn");
  var authError = document.getElementById("authError");
  var authToggleText = document.getElementById("authToggleText");
  var authToggleLink = document.getElementById("authToggleLink");
  var userEmail = document.getElementById("userEmail");
  var logoutBtn = document.getElementById("logoutBtn");
  var currentHistory = [];
  var pinnedItems = [];
  var activeTab = "all";
  var searchQuery = "";
  var isSignUpMode = false;
  function initTheme() {
    const saved = localStorage.getItem("clipsync-theme");
    if (saved === "dark" || !saved && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.setAttribute("data-theme", "dark");
      themeToggle.textContent = "\u2600\uFE0F";
    } else {
      themeToggle.textContent = "\u{1F319}";
    }
  }
  themeToggle.onclick = () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("clipsync-theme", "light");
      themeToggle.textContent = "\u{1F319}";
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("clipsync-theme", "dark");
      themeToggle.textContent = "\u2600\uFE0F";
    }
  };
  initTheme();
  function showAuth() {
    authScreen.classList.add("visible");
    appScreen.classList.remove("visible");
    statusText.textContent = "Not signed in";
    statusDot.classList.remove("connected");
    statusDot.classList.add("error");
  }
  function showApp(email) {
    authScreen.classList.remove("visible");
    appScreen.classList.add("visible");
    userEmail.textContent = email || "";
    statusText.textContent = "Connected";
    statusDot.classList.remove("error");
    statusDot.classList.add("connected");
    sendBtn.disabled = false;
  }
  function showAuthError(msg) {
    authError.textContent = msg;
    authError.classList.add("visible");
  }
  function clearAuthError() {
    authError.classList.remove("visible");
  }
  authToggleLink.onclick = () => {
    isSignUpMode = !isSignUpMode;
    clearAuthError();
    if (isSignUpMode) {
      authTitle.textContent = "Create an account";
      authBtn.textContent = "Sign Up";
      authToggleText.textContent = "Already have an account?";
      authToggleLink.textContent = "Sign in";
    } else {
      authTitle.textContent = "Sign in to ClipSync";
      authBtn.textContent = "Sign In";
      authToggleText.textContent = "Don't have an account?";
      authToggleLink.textContent = "Create one";
    }
  };
  authBtn.onclick = async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    if (!email || !password) {
      showAuthError("Please enter email and password.");
      return;
    }
    if (password.length < 6) {
      showAuthError("Password must be at least 6 characters.");
      return;
    }
    clearAuthError();
    authBtn.disabled = true;
    authBtn.textContent = isSignUpMode ? "Creating account\u2026" : "Signing in\u2026";
    const msgType = isSignUpMode ? "SIGN_UP" : "SIGN_IN";
    const res = await chrome.runtime.sendMessage({ type: msgType, email, password });
    if (res && res.ok) {
      authBtn.textContent = "Success \u2713";
    } else {
      const errMsg = res?.error || "Unknown error";
      if (errMsg.includes("user-not-found")) {
        showAuthError("No account found with this email. Create one instead?");
      } else if (errMsg.includes("wrong-password") || errMsg.includes("invalid-credential")) {
        showAuthError("Incorrect password. Please try again.");
      } else if (errMsg.includes("email-already-in-use")) {
        showAuthError("This email is already registered. Try signing in.");
      } else if (errMsg.includes("invalid-email")) {
        showAuthError("Please enter a valid email address.");
      } else if (errMsg.includes("weak-password")) {
        showAuthError("Password is too weak. Use at least 6 characters.");
      } else {
        showAuthError(errMsg);
      }
      authBtn.disabled = false;
      authBtn.textContent = isSignUpMode ? "Sign Up" : "Sign In";
    }
  };
  authPassword.addEventListener("keydown", (e) => {
    if (e.key === "Enter") authBtn.click();
  });
  logoutBtn.onclick = async () => {
    const res = await chrome.runtime.sendMessage({ type: "SIGN_OUT" });
    if (res && res.ok) {
      showAuth();
      showToast("Signed out \u2713");
      authEmail.value = "";
      authPassword.value = "";
      isSignUpMode = false;
      authTitle.textContent = "Sign in to ClipSync";
      authBtn.textContent = "Sign In";
      authBtn.disabled = false;
      authToggleText.textContent = "Don't have an account?";
      authToggleLink.textContent = "Create one";
      clearAuthError();
      currentHistory = [];
      pinnedItems = [];
      renderCurrentTab();
    }
  };
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
  function timeAgo(ts) {
    if (!ts || !ts.seconds) return "";
    const diffSec = Math.max(0, Math.floor(Date.now() / 1e3 - ts.seconds));
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
    } catch {
    }
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
  function showToast(msg, duration = 2e3) {
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
      showToast("Unpinned \u2713");
    } else {
      pinnedItems.push({ text, sourceDevice, createdAt, pinned: true });
      showToast("Pinned \u2713");
    }
    await chrome.storage.local.set({ pinnedItems });
    updateCounts();
    renderCurrentTab();
  }
  async function deleteItem(item) {
    if (!item.id) {
      showToast("Cannot delete \u2014 no document ID");
      return;
    }
    const res = await chrome.runtime.sendMessage({ type: "DELETE_HISTORY", docId: item.id });
    if (res && res.ok) {
      if (isPinned(item.text)) {
        pinnedItems = pinnedItems.filter((p) => p.text !== item.text);
        await chrome.storage.local.set({ pinnedItems });
      }
      showToast("Deleted \u2713");
    } else {
      showToast("Delete failed: " + (res?.error || "unknown"));
    }
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
  function renderItems(container, items, showPinAction = true) {
    container.innerHTML = "";
    const filtered = filterItems(items);
    if (!filtered || filtered.length === 0) {
      const emptyType = activeTab === "pinned" ? "pinned" : "history";
      container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${emptyType === "pinned" ? "\u{1F4CC}" : "\u{1F4CB}"}</div>
        <div class="empty-title">${emptyType === "pinned" ? "No pinned clips" : searchQuery ? "No results found" : "Nothing synced yet"}</div>
        <div class="empty-desc">${emptyType === "pinned" ? "Hover over a clip and click the pin icon to keep it handy." : searchQuery ? "Try a different search term." : "Copy something and send it, or wait for clips from your other devices."}</div>
      </div>
    `;
      return;
    }
    for (const item of filtered) {
      const el = document.createElement("div");
      el.className = "clip-item";
      const urlCheck = isUrl(item.text);
      const textEl = document.createElement("div");
      textEl.className = "clip-text" + (urlCheck ? " url-text" : "");
      textEl.textContent = item.text;
      el.appendChild(textEl);
      if (urlCheck) {
        const preview = document.createElement("div");
        preview.className = "clip-url-preview";
        preview.innerHTML = `<span>\u{1F517}</span><span class="domain">${getDomain(item.text)}</span>`;
        el.appendChild(preview);
      }
      const meta = document.createElement("div");
      meta.className = "clip-meta";
      const info = document.createElement("div");
      info.className = "clip-info";
      const device = item.sourceDevice || "unknown";
      const badgeClass = device === "chrome" ? "chrome" : device === "android" ? "android" : "unknown";
      const deviceIcon = device === "chrome" ? "\u{1F4BB}" : device === "android" ? "\u{1F4F1}" : "\u2753";
      info.innerHTML = `<span class="device-badge ${badgeClass}">${deviceIcon} ${device}</span><span>${timeAgo(item.createdAt)}</span>`;
      meta.appendChild(info);
      const actions = document.createElement("div");
      actions.className = "clip-actions";
      const copyBtn = document.createElement("button");
      copyBtn.className = "clip-action-btn";
      copyBtn.title = "Copy to clipboard";
      copyBtn.textContent = "\u{1F4CB}";
      copyBtn.onclick = async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(item.text);
        el.classList.add("copied");
        showToast("Copied to clipboard \u2713");
        setTimeout(() => el.classList.remove("copied"), 600);
      };
      actions.appendChild(copyBtn);
      if (showPinAction) {
        const pinBtn = document.createElement("button");
        const pinned = isPinned(item.text);
        pinBtn.className = "clip-action-btn" + (pinned ? " pinned pin-visible" : "");
        pinBtn.title = pinned ? "Unpin" : "Pin this clip";
        pinBtn.textContent = pinned ? "\u{1F4CC}" : "\u{1F4CD}";
        pinBtn.onclick = (e) => {
          e.stopPropagation();
          togglePin(item.text, item.sourceDevice, item.createdAt);
        };
        actions.appendChild(pinBtn);
      }
      if (activeTab === "pinned") {
        const removeBtn = document.createElement("button");
        removeBtn.className = "clip-action-btn";
        removeBtn.title = "Unpin";
        removeBtn.textContent = "\u2715";
        removeBtn.onclick = (e) => {
          e.stopPropagation();
          togglePin(item.text);
        };
        actions.appendChild(removeBtn);
      }
      if (activeTab === "all" && item.id) {
        const delBtn = document.createElement("button");
        delBtn.className = "clip-action-btn delete-btn";
        delBtn.title = "Delete";
        delBtn.textContent = "\u{1F5D1}\uFE0F";
        delBtn.onclick = (e) => {
          e.stopPropagation();
          deleteItem(item);
        };
        actions.appendChild(delBtn);
      }
      meta.appendChild(actions);
      el.appendChild(meta);
      el.onclick = async () => {
        await navigator.clipboard.writeText(item.text);
        el.classList.add("copied");
        showToast("Copied to clipboard \u2713");
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
  async function init() {
    const { signedIn, userEmail: email, authError: err, history, pinnedItems: savedPins } = await chrome.storage.local.get([
      "signedIn",
      "userEmail",
      "authError",
      "history",
      "pinnedItems"
    ]);
    if (signedIn && email) {
      showApp(email);
    } else {
      showAuth();
    }
    currentHistory = history || [];
    pinnedItems = savedPins || [];
    renderCurrentTab();
  }
  sendBtn.onclick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        showToast("Clipboard is empty");
        return;
      }
      sendBtn.disabled = true;
      sendLabel.textContent = "Sending\u2026";
      const res = await chrome.runtime.sendMessage({ type: "PUSH_CLIPBOARD", text });
      if (res.ok) {
        sendLabel.textContent = "Sent \u2713";
        showToast("Clipboard sent to your devices \u2713");
      } else {
        sendLabel.textContent = `Failed`;
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
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.signedIn || changes.userEmail) init();
    if (changes.history) {
      currentHistory = changes.history.newValue || [];
      renderCurrentTab();
    }
    if (changes.pinnedItems) {
      pinnedItems = changes.pinnedItems.newValue || [];
      renderCurrentTab();
    }
  });
  chrome.runtime.sendMessage({ type: "CLEAR_BADGE" }).catch(() => {
  });
})();
