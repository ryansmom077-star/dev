/**
 * @name CS2AutoConnect
 * @author codex + upgraded
 * @version 7.0.0
 * @description Ultra reliable CS2 auto connect plugin with observer batching, queue protection,
 * fingerprint dedupe, automation recovery, improved fallback handling, keyword-based team filtering
 * to prevent false-positive connects to other teams' matches, steam:// URL as primary connect method,
 * suppressed duplicate error toasts, reconnect-loop prevention, and minimised latency for sim priority.
 *
 * CHANGES IN v7:
 *  - Fix reconnect loop: connectedAddresses Set tracks every address we successfully connected to
 *    this session. Any future auto-connect attempt to the same address is silently skipped.
 *    Reset by stopping/starting the plugin or toggling the CS2 button OFF then ON.
 *  - Faster sim-priority: default cooldown reduced 5000→500 ms, retryDelay reduced 700→200 ms.
 *    When nothing is currently processing, the queue is bypassed entirely and the connect fires
 *    on the same microtask tick as the message detection (no unnecessary sleep).
 *  - Address clarity: success toast now shows the exact server IP:PORT you are connecting TO,
 *    so you can confirm the script is hitting the game server and not yourself.
 *  - All v6 features kept intact (keyword filter, steam://, toast dedup, AHK/PowerShell fallbacks).
 */

module.exports = class CS2AutoConnect {
  constructor() {
    this.tag = "[CS2AutoConnect]";

    this.messageState = new Map();
    this.messageFingerprints = new Map();
    this.maxFingerprints = 5000;

    this.lastFound = null;

    // Track addresses for which the failure toast has already been shown this session
    this.failedToastAddresses = new Set();

    // v7: Track addresses we have SUCCESSFULLY connected to this session.
    // Any auto-connect attempt to an already-connected address is silently dropped,
    // which prevents the reconnect loop caused by Discord re-rendering the same message.
    // Cleared when the plugin is stopped or the CS2 button is toggled OFF.
    this.connectedAddresses = new Set();

    this.observer = null;
    this.pendingNodes = new Set();
    this.observerFlushScheduled = false;

    this.queue = [];
    this.processing = false;
    this.activeLaunch = false;
    this.lastLaunchAt = 0;

    this.button = null;
    this.buttonId = "cs2ac-toggle-btn";

    this.consoleBindKey = "{VK_OEM_3}";
    this.ahkScriptName = "CS2AutoPaste.ahk";

    this.settings = {
      autoEnabled: true,
      // v7: reduced from 5000 → 500 ms for faster sim-priority connects.
      // Set to 0 to fire with no inter-connect delay (not recommended if you share a channel).
      cooldown: 500,
      debug: false,
      retryAttempts: 3,
      // v7: reduced from 700 → 200 ms between retry attempts.
      retryDelay: 200,
      seenFingerprints: [],

      // --- NEW in v6 ---
      // List of keywords that MUST appear in a message for auto-connect to fire.
      // Example: [".win", "team_odin"] — set to your own team name.
      // If this array is empty, ALL detected connect commands will fire (original behaviour).
      filterKeywords: [],

      // When true, auto-connect is ONLY attempted if at least one filterKeyword matches.
      // When false (default) the keywords act as a soft hint and all commands fire.
      requireKeyword: false
    };

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onButtonClick = this.onButtonClick.bind(this);
  }

  // ─────────────────────────────────────────────────
  //  Lifecycle
  // ─────────────────────────────────────────────────

  start() {
    try {
      this.loadSettings();
      this.ensureAhkScript();
      this.mountButton();
      this.setupObserver();

      document.addEventListener("keydown", this.onKeyDown, true);

      this.bootstrapInitialMessages();

      BdApi.UI.showToast("CS2AutoConnect v7 active", { type: "success" });

      this.log("plugin started");
    } catch (e) {
      console.error(this.tag, "start failed", e);
    }
  }

  stop() {
    try {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      document.removeEventListener("keydown", this.onKeyDown, true);

      this.unmountButton();

      this.pendingNodes.clear();
      this.queue = [];
      this.processing = false;
      this.activeLaunch = false;
      this.failedToastAddresses.clear();
      this.connectedAddresses.clear(); // v7: reset so plugin can re-connect after restart

      this.saveSettings();

      BdApi.UI.showToast("CS2AutoConnect stopped", { type: "info" });
    } catch (e) {
      console.error(this.tag, "stop failed", e);
    }
  }

  // ─────────────────────────────────────────────────
  //  Settings
  // ─────────────────────────────────────────────────

  loadSettings() {
    try {
      const saved = BdApi.Data.load("CS2AutoConnect", "settings");

      if (saved && typeof saved === "object") {
        this.settings = { ...this.settings, ...saved };
      }
    } catch (e) {
      this.log("settings load failed", e);
    }
  }

  saveSettings() {
    try {
      BdApi.Data.save("CS2AutoConnect", "settings", this.settings);
    } catch (e) {
      this.log("settings save failed", e);
    }
  }

  // ─────────────────────────────────────────────────
  //  Debug
  // ─────────────────────────────────────────────────

  log(...args) {
    if (!this.settings.debug) return;
    console.log(`${this.tag} [${new Date().toISOString()}]`, ...args);
  }

  // ─────────────────────────────────────────────────
  //  Observer
  // ─────────────────────────────────────────────────

  setupObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          this.collectMessageNode(node);
        }

        if (mutation.type === "characterData") {
          const parent = mutation.target?.parentElement;
          if (parent) {
            this.collectMessageNode(parent);
          }
        }
      }

      this.scheduleObserverFlush();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  bootstrapInitialMessages() {
    try {
      const nodes = document.querySelectorAll(
        '[id^="chat-messages-"], [data-list-item-id^="chat-messages___"]'
      );

      const recent = Array.from(nodes).slice(-20);

      for (const node of recent) {
        this.processMessageNode(node, true);
      }
    } catch (e) {
      this.log("bootstrap failed", e);
    }
  }

  collectMessageNode(node) {
    try {
      if (!node || !(node instanceof HTMLElement)) return;

      const msg =
        node.closest?.('[id^="chat-messages-"], [data-list-item-id^="chat-messages___"]') ||
        (node.matches?.('[id^="chat-messages-"], [data-list-item-id^="chat-messages___"]')
          ? node
          : null);

      if (!msg) return;

      this.pendingNodes.add(msg);
    } catch (e) {
      this.log("collectMessageNode failed", e);
    }
  }

  scheduleObserverFlush() {
    if (this.observerFlushScheduled) return;

    this.observerFlushScheduled = true;

    queueMicrotask(() => {
      this.observerFlushScheduled = false;

      const nodes = Array.from(this.pendingNodes);
      this.pendingNodes.clear();

      for (const node of nodes) {
        this.processMessageNode(node);
      }
    });
  }

  // ─────────────────────────────────────────────────
  //  Message Processing
  // ─────────────────────────────────────────────────

  processMessageNode(node, markOnly = false) {
    try {
      const id = this.getMessageId(node);
      if (!id) return;

      const text = this.extractText(node);
      if (!text) return;

      const info = this.extract(text);
      if (!info) return;

      if (!this.validateTarget(info)) return;

      // v7: reconnect-loop guard — if we already successfully connected to this address
      // this session, silently drop the message (Discord re-renders the same message
      // repeatedly which would otherwise keep firing the connect command).
      if (this.connectedAddresses.has(info.address)) {
        this.log("skipped (already connected this session):", info.address);
        return;
      }

      // ── v6: keyword filter ───────────────────────
      // If requireKeyword is true AND filterKeywords is non-empty, skip unless a
      // keyword appears somewhere in the message text (case-insensitive).
      if (this.settings.requireKeyword && this.settings.filterKeywords.length > 0) {
        const lower = text.toLowerCase();
        const matched = this.settings.filterKeywords.some(kw =>
          lower.includes(kw.toLowerCase())
        );

        if (!matched) {
          this.log("skipped (keyword not matched):", info.address);
          return;
        }
      }
      // ─────────────────────────────────────────────

      const fingerprint = this.buildFingerprint(id, text, info);
      const existing = this.messageFingerprints.get(id);

      if (existing === fingerprint) return;

      this.messageFingerprints.set(id, fingerprint);

      if (this.settings.seenFingerprints.includes(fingerprint)) return;

      this.settings.seenFingerprints.push(fingerprint);

      if (this.settings.seenFingerprints.length > 3000) {
        this.settings.seenFingerprints = this.settings.seenFingerprints.slice(-1500);
      }

      this.saveSettings();

      this.lastFound = info;

      if (markOnly || !this.settings.autoEnabled) return;

      this.enqueue(info, fingerprint);
    } catch (e) {
      this.log("processMessageNode failed", e);
    }
  }

  extractText(node) {
    try {
      return (node.innerText || "").replace(/\u00A0/g, " ").trim();
    } catch {
      return null;
    }
  }

  getMessageId(node) {
    const id1 = node.getAttribute("id");
    if (id1 && id1.startsWith("chat-messages-")) return id1;

    const id2 = node.getAttribute("data-list-item-id");
    if (id2 && id2.startsWith("chat-messages___")) return id2;

    return null;
  }

  buildFingerprint(id, text, info) {
    const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
    return this.hash(`${id}|${info.address}|${info.password || ""}|${normalized}`);
  }

  hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  }

  // ─────────────────────────────────────────────────
  //  Extraction & Validation
  // ─────────────────────────────────────────────────

  extract(text) {
    if (!text) return null;

    const cleaned = text
      .replace(/```([\s\S]*?)```/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\s+/g, " ")
      .trim();

    const patterns = [
      /steam:\/\/connect\/([^\s/]+)(?:\/([^\s]+))?/i,

      /\bconnect\s+((?:\d{1,3}\.){3}\d{1,3}:\d{2,5}|[a-z0-9.-]+:\d{2,5})\s*(?:;|\s)?\s*(?:(?:password|pass|pw)\s*[:=]?\s*(?:"([^"]+)"|'([^']+)'|([^\s;`]+)))?/i
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (!match) continue;

      return {
        address: (match[1] || "").trim(),
        password: (match[2] || match[3] || match[4] || "").trim() || null
      };
    }

    return null;
  }

  validateTarget(info) {
    try {
      if (!info || !info.address) return false;

      const address = String(info.address).trim();

      if (/[;&|`$><]/.test(address)) return false;

      const regex = /^(?:\d{1,3}\.){3}\d{1,3}:\d{2,5}$|^[a-z0-9.-]+:\d{2,5}$/i;

      if (!regex.test(address)) return false;

      const port = parseInt(address.split(":").pop(), 10);

      return port >= 1 && port <= 65535;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────
  //  Queue
  // ─────────────────────────────────────────────────

  enqueue(info, fingerprint) {
    if (this.queue.find(q => q.fingerprint === fingerprint)) return;

    this.queue.push({ info, fingerprint, attempts: 0 });

    // v7: if the queue processor is idle AND enough time has passed since the last launch,
    // kick off immediately (no extra sleep) so we connect as early as possible.
    this.processQueue();
  }

  async processQueue() {
    if (this.processing) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();

      const elapsed = Date.now() - this.lastLaunchAt;

      // v7: only sleep the cooldown when we actually launched something recently.
      // On first launch (lastLaunchAt === 0) or when cooldown has already elapsed,
      // skip the sleep entirely so the connect fires as fast as possible.
      if (this.lastLaunchAt > 0 && elapsed < this.settings.cooldown) {
        await this.sleep(this.settings.cooldown - elapsed);
      }

      try {
        const success = await this.launchWithRecovery(item.info);

        if (!success && item.attempts < this.settings.retryAttempts) {
          item.attempts++;
          this.queue.push(item);
        }

        this.lastLaunchAt = Date.now();
      } catch (e) {
        this.log("queue failed", e);
      }
    }

    this.processing = false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─────────────────────────────────────────────────
  //  Keybind
  // ─────────────────────────────────────────────────

  onKeyDown(e) {
    if (!(e.ctrlKey && e.shiftKey && e.code === "KeyC")) return;
    if (!this.lastFound) return;

    this.launchWithRecovery(this.lastFound, true);
  }

  // ─────────────────────────────────────────────────
  //  Launch helpers
  // ─────────────────────────────────────────────────

  escapeForConsole(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  buildConsoleCommand(info) {
    const connect = `connect ${info.address}`;
    if (!info.password) return connect;
    return `password "${this.escapeForConsole(info.password)}"; ${connect}`;
  }

  async copyToClipboard(text) {
    for (let i = 0; i < 3; i++) {
      try {
        if (window?.DiscordNative?.clipboard?.copy) {
          window.DiscordNative.clipboard.copy(text);
          return true;
        }
      } catch {}

      try {
        const electron = require("electron");
        if (electron?.clipboard?.writeText) {
          electron.clipboard.writeText(text);
          if (electron.clipboard.readText() === text) return true;
        }
      } catch {}

      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {}

      await this.sleep(50);
    }

    return false;
  }

  // ── v6: Steam URL connect (most reliable, tried FIRST) ──────────────────
  /**
   * Opens a steam://connect/ URL which causes Steam to launch CS2 and
   * connect to the server directly — no AHK or PowerShell required.
   * Format: steam://connect/<ip>:<port>/<password>
   */
  trySteamConnect(info) {
    try {
      const electron = require("electron");
      const shell = electron?.shell || electron?.remote?.shell;

      if (!shell?.openExternal) {
        this.log("trySteamConnect: electron shell not available");
        return false;
      }

      let url = `steam://connect/${info.address}`;
      if (info.password) url += `/${encodeURIComponent(info.password)}`;

      shell.openExternal(url);

      this.log("trySteamConnect:", url);

      return true;
    } catch (e) {
      this.log("trySteamConnect failed", e);
      return false;
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  ensureAhkScript() {
    try {
      const fs = require("fs");
      const path = require("path");

      const scriptPath = path.join(__dirname, this.ahkScriptName);

      if (fs.existsSync(scriptPath)) return;

      fs.writeFileSync(
        scriptPath,
        [
          "#Requires AutoHotkey v2.0",
          "SetTitleMatchMode 2",
          "DetectHiddenWindows true",
          "WinRestore 'ahk_exe cs2.exe'",
          "Sleep 100",
          "WinActivate 'ahk_exe cs2.exe'",
          "Sleep 150",
          "Send '{Esc}'",
          "Sleep 100",
          "Send '{vkC0}'",
          "Sleep 180",
          "Send '^v'",
          "Sleep 120",
          "Send '{Enter}'"
        ].join("`n")
      );
    } catch (e) {
      this.log("ensureAhkScript failed", e);
    }
  }

  tryRunAhkPaste() {
    try {
      const cp = require("child_process");
      const path = require("path");

      const scriptPath = path.join(__dirname, this.ahkScriptName);

      const child = cp.spawn("AutoHotkey.exe", [scriptPath], {
        detached: true,
        windowsHide: true,
        stdio: "ignore"
      });

      child.unref();

      return true;
    } catch {
      return false;
    }
  }

  tryOpenConsoleAndPasteFallback(command) {
    try {
      const cp = require("child_process");

      const safe = command.replace(/'/g, "''");

      const script = [
        "$ws = New-Object -ComObject WScript.Shell",
        "if (-not ($ws.AppActivate('Counter-Strike 2') -or $ws.AppActivate('cs2'))) { exit 3 }",
        "Start-Sleep -Milliseconds 250",
        `Set-Clipboard -Value '${safe}'`,
        "Start-Sleep -Milliseconds 100",
        `$ws.SendKeys('${this.consoleBindKey}')`,
        "Start-Sleep -Milliseconds 220",
        "$ws.SendKeys('^v')",
        "Start-Sleep -Milliseconds 120",
        "$ws.SendKeys('{ENTER}')"
      ].join("; ");

      const result = cp.spawnSync("powershell.exe", ["-NoProfile", "-Command", script], {
        encoding: "utf8",
        windowsHide: true
      });

      return !result.error && result.status === 0;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────
  //  Core launch — v7: steam:// first, address toast, reconnect guard
  // ─────────────────────────────────────────────────

  async launchWithRecovery(info, manual = false) {
    const command = this.buildConsoleCommand(info);

    for (let attempt = 1; attempt <= this.settings.retryAttempts; attempt++) {
      // ── 1. Try steam:// URL (most reliable, tried FIRST) ─────────────────
      if (this.trySteamConnect(info)) {
        // v7: mark connected so reconnect guard blocks future auto-fires
        this.connectedAddresses.add(info.address);

        // v7: show exact server address — confirms we're connecting to the game server
        BdApi.UI.showToast(
          `${manual ? "Manual" : "Auto"} connect → ${info.address}`,
          { type: "success" }
        );
        return true;
      }

      // ── 2. Copy to clipboard ─────────────────────────────────────────────
      const copied = await this.copyToClipboard(command);

      if (!copied) {
        await this.sleep(this.settings.retryDelay);
        continue;
      }

      // ── 3. Try AHK then PowerShell ───────────────────────────────────────
      const pasted =
        this.tryRunAhkPaste() ||
        this.tryOpenConsoleAndPasteFallback(command);

      if (pasted) {
        // v7: mark connected and show address
        this.connectedAddresses.add(info.address);

        BdApi.UI.showToast(
          `${manual ? "Manual" : "Auto"} connect → ${info.address}`,
          { type: "success" }
        );
        return true;
      }

      await this.sleep(this.settings.retryDelay);
    }

    // Only show failure toast once per address this session
    if (!this.failedToastAddresses.has(info.address)) {
      this.failedToastAddresses.add(info.address);
      BdApi.UI.showToast("CS2 automation failed", { type: "error" });
    }

    return false;
  }

  // ─────────────────────────────────────────────────
  //  UI Button
  // ─────────────────────────────────────────────────

  mountButton() {
    if (this.button && this.button.isConnected) return;

    const selectors = [
      "button[aria-label='User Settings']",
      "button[aria-label*='Settings']",
      "button[aria-label*='Настройки']"
    ];

    let settingsBtn = null;

    for (const selector of selectors) {
      settingsBtn = document.querySelector(selector);
      if (settingsBtn) break;
    }

    if (!settingsBtn || !settingsBtn.parentElement) return;

    const btn = document.createElement("button");

    btn.id = this.buttonId;
    btn.innerText = "CS2";
    btn.style.marginRight = "6px";

    btn.addEventListener("click", this.onButtonClick);

    settingsBtn.parentElement.insertBefore(btn, settingsBtn);

    this.button = btn;

    this.updateButtonState();
  }

  onButtonClick() {
    this.settings.autoEnabled = !this.settings.autoEnabled;

    // v7: when toggling OFF, reset the connected-addresses guard so that
    // toggling back ON allows a fresh connect to any server.
    if (!this.settings.autoEnabled) {
      this.connectedAddresses.clear();
      this.failedToastAddresses.clear();
    }

    this.saveSettings();
    this.updateButtonState();

    BdApi.UI.showToast(`CS2 Auto ${this.settings.autoEnabled ? "ON" : "OFF"}`, {
      type: this.settings.autoEnabled ? "success" : "warning"
    });
  }

  updateButtonState() {
    if (!this.button) return;
    this.button.style.opacity = this.settings.autoEnabled ? "1" : "0.5";
  }

  unmountButton() {
    try {
      if (!this.button) return;
      this.button.removeEventListener("click", this.onButtonClick);
      this.button.remove();
      this.button = null;
    } catch {}
  }
};
