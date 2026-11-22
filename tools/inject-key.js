// Injecte la clé OpenAI (secret GitHub OPENAI_API_KEY) dans le fichier construit, sous forme encodée.
// Usage : node tools/inject-key.js chemin/vers/index.html
const fs = require("fs");
const file = process.argv[2];
const key = (process.env.OPENAI_API_KEY || "").trim();
let html = fs.readFileSync(file, "utf8");
if (key) {
  const encoded = Buffer.from(key.split("").reverse().join("")).toString("base64");
  html = html.replace("__HURLUNE_OA__", encoded);
  console.log("Clé OpenAI intégrée.");
} else {
  console.log("Aucun secret OPENAI_API_KEY : traduction Google par défaut.");
}
fs.writeFileSync(file, html);
