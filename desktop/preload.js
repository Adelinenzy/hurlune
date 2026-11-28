// Pont minimal entre le jeu et l'appli : presse-papiers et proxy
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("HurluneNative", {
  platform: "desktop",
  copy: (s) => ipcRenderer.invoke("hl-copy", String(s)),
  paste: () => ipcRenderer.invoke("hl-paste"),
  setProxy: (u) => ipcRenderer.invoke("hl-proxy", String(u || "")),
  getProxy: () => ipcRenderer.invoke("hl-proxy-get")
});
