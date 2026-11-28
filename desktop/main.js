// Hurlune — application de bureau (Electron)
const { app, BrowserWindow, shell, Menu, session, systemPreferences, ipcMain, clipboard } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");

/* ---- Proxy intégré (le même que Nepotify) : seuls les services du jeu passent par lui ----
   Identifiants ajoutés à la compilation (proxy.json), jamais dans le dépôt ni réglables par les joueurs. */
const PROXY = "proxy.nepotify.devs.surf:443";
const ROUTED = ["emqx.io", "hivemq.com", "mosquitto.org", "openai.com", "translate.googleapis.com", "mymemory.translated.net"];
let proxyAuth = null;
try {
  const x = JSON.parse(fs.readFileSync(path.join(__dirname, "proxy.json"), "utf8"));
  if (x && x.user && x.password) proxyAuth = { user: String(x.user), pass: String(x.password) };
} catch (e) {}
function pacText() {
  return `function FindProxyForURL(url, host) {
  host = String(host || "").toLowerCase().replace(/\\.$/, "");
  var s = ${JSON.stringify(ROUTED)};
  for (var i = 0; i < s.length; i++) if (host === s[i] || dnsDomainIs(host, "." + s[i])) return "HTTPS ${PROXY}; DIRECT";
  return "DIRECT";
}`;
}
async function applyProxy() {
  if (!proxyAuth) return;
  const srv = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "application/x-ns-proxy-autoconfig", "Cache-Control": "no-store" }); res.end(pacText()); });
  await new Promise((ok, ko) => { srv.once("error", ko); srv.listen(0, "127.0.0.1", ok); });
  await session.defaultSession.setProxy({ mode: "pac_script", pacScript: `http://127.0.0.1:${srv.address().port}/hurlune.pac` });
}
app.on("login", (e, wc, details, authInfo, cb) => {
  if (authInfo.isProxy && proxyAuth) { e.preventDefault(); cb(proxyAuth.user, proxyAuth.pass); }
});
ipcMain.handle("hl-copy", (e, s) => { clipboard.writeText(s); return true; });
ipcMain.handle("hl-paste", () => clipboard.readText());

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
  try { await applyProxy(); } catch (e) { console.warn("proxy", e); }
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
