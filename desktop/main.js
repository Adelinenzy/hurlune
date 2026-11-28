// Hurlune — application de bureau (Electron)
const { app, BrowserWindow, shell, Menu, session, systemPreferences, ipcMain, clipboard } = require("electron");
const path = require("path");
const fs = require("fs");

/* ---- Proxy (http://, https://, socks4://, socks5://, avec identifiants éventuels) ---- */
const proxyFile = () => path.join(app.getPath("userData"), "proxy.json");
let proxyAuth = null;
function readProxy() { try { return JSON.parse(fs.readFileSync(proxyFile(), "utf8")).url || ""; } catch (e) { return ""; } }
async function applyProxy(url) {
  url = String(url || "").trim(); proxyAuth = null;
  if (!url) { await session.defaultSession.setProxy({ mode: "direct" }); }
  else {
    const u = new URL(url);
    if (u.username) proxyAuth = { user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password) };
    const scheme = u.protocol.replace(":", "");
    const rule = scheme + "://" + u.hostname + (u.port ? ":" + u.port : "");
    await session.defaultSession.setProxy({ mode: "fixed_servers", proxyRules: rule, proxyBypassRules: "<local>" });
  }
  try { await session.defaultSession.closeAllConnections(); } catch (e) {}
}
app.on("login", (e, wc, details, authInfo, cb) => {
  if (authInfo.isProxy && proxyAuth) { e.preventDefault(); cb(proxyAuth.user, proxyAuth.pass); }
});
ipcMain.handle("hl-copy", (e, s) => { clipboard.writeText(s); return true; });
ipcMain.handle("hl-paste", () => clipboard.readText());
ipcMain.handle("hl-proxy-get", () => readProxy());
ipcMain.handle("hl-proxy", async (e, url) => {
  try { if (url) new URL(url); } catch (err) { return false; }
  try { fs.writeFileSync(proxyFile(), JSON.stringify({ url })); } catch (err) {}
  await applyProxy(url); return true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#1b1c2a",
    title: "Hurlune",
    icon: require("path").join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false } // l'hôte continue de faire tourner la partie même fenêtre réduite
  });
  // Liens externes (invitations, aide) : ouverts dans le navigateur
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://")) { e.preventDefault(); shell.openExternal(url); }
  });
  win.loadFile(path.join(__dirname, "app", "index.html"));
}

Menu.setApplicationMenu(null);
app.whenReady().then(async () => {
  // Micro autorisé pour le chat vocal (uniquement l'audio)
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb, details) => {
    if (perm === "media") {
      const audioOnly = !(details.mediaTypes || []).includes("video");
      if (audioOnly && process.platform === "darwin") { systemPreferences.askForMediaAccess("microphone").then(cb).catch(() => cb(false)); return; }
      cb(audioOnly); return;
    }
    if (perm === "clipboard-read" || perm === "clipboard-sanitized-write") { cb(true); return; }
    cb(false);
  });
  session.defaultSession.setPermissionCheckHandler((wc, perm) => perm === "media" || perm === "clipboard-read" || perm === "clipboard-sanitized-write");
  try { await applyProxy(readProxy()); } catch (e) {}
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
