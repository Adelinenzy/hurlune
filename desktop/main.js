// Hurlune — application de bureau (Electron)
const { app, BrowserWindow, shell, Menu, session, systemPreferences } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#1b1c2a",
    title: "Hurlune",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  // Liens externes (invitations, aide) : ouverts dans le navigateur
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://")) { e.preventDefault(); shell.openExternal(url); }
  });
  win.loadFile(path.join(__dirname, "app", "index.html"));
}

Menu.setApplicationMenu(null);
app.whenReady().then(() => {
  // Micro autorisé pour le chat vocal (uniquement l'audio)
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb, details) => {
    if (perm === "media") {
      const audioOnly = !(details.mediaTypes || []).includes("video");
      if (audioOnly && process.platform === "darwin") { systemPreferences.askForMediaAccess("microphone").then(cb).catch(() => cb(false)); return; }
      cb(audioOnly); return;
    }
    cb(false);
  });
  session.defaultSession.setPermissionCheckHandler((wc, perm) => perm === "media");
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
