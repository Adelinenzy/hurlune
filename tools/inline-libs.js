// Intègre la bibliothèque MQTT directement dans le fichier du jeu (aucun CDN nécessaire :
// unpkg/jsdelivr passent par des réseaux parfois bloqués en Russie).
// Usage : node tools/inline-libs.js chemin/vers/index.html
const fs = require("fs");
const path = require("path");
const file = process.argv[2];
const lib = require.resolve("mqtt/dist/mqtt.min.js", { paths: [path.join(__dirname, "libs"), process.cwd()] });
const code = fs.readFileSync(lib, "utf8").replace(/<\/script/gi, "<\\/script");
let html = fs.readFileSync(file, "utf8");
const marker = '<script>\n"use strict";';
if (!html.includes(marker)) throw new Error("marqueur introuvable");
html = html.replace(marker, "<script>\n" + code + "\n</script>\n" + marker);
fs.writeFileSync(file, html);
console.log("MQTT intégré (" + Math.round(code.length / 1024) + " Ko).");
