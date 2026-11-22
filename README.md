# 🌕 Hurlune — Loups-Garous entre amis

Jeu de Loups-Garous en ligne inspiré du fonctionnement de Wolfy, pensé pour jouer **entre amis français et russes** :

- **Sans compte** : un pseudo, un personnage, et c'est parti.
- **Chat traduisible en un clic** (🌐). Si l'hôte a mis sa clé OpenAI dans les ⚙︎ paramètres, la traduction se fait par OpenAI pour tout le monde. Sinon, c'est Google Traduction.
- **Interface en français, russe et anglais.**
- **29 rôles** :
  - Loups : Loup-Garou, Loup Noir, Loup Bavard, Loup Lettré, Chaperon Loup.
  - Solitaires : Loup Blanc, Mercenaire, Rat Malade.
  - Village : Voyante, Voyante Bavarde, Voyante d'Aura, Sorcière, Guérisseuse, Empoisonneuse, Chasseur, Garde, Petite Fille, Cupidon, Chaperons Rouge/Rose/Bleu, Mentaliste, Nécromancien, Fossoyeur, Dictateur, Héritier, Pillard, Pyromancien, Simple Villageois.
- **Déroulement** :
  - La nuit, les rôles jouent chacun leur tour. Le jour, on vote en cliquant sur les personnages, et le premier vote contre quelqu'un doit être justifié.
  - Quand une majorité se dégage, le minuteur passe à 30 s.
  - Le maire est élu au 2ᵉ jour, avec candidatures, et il départage les égalités.
  - Il y a un chat pour la meute, les morts et les amoureux, plus les @mentions.

## Jouer

- **Dans le navigateur** : https://adelinenzy.github.io/hurlune/
- **Appli PC/Mac/Linux** : onglet [Releases](../../releases) → télécharge le fichier pour ton système.

Crée une partie, puis clique sur **Inviter** et envoie le lien à tes amis. La partie démarre dès que toutes les places sont prises, ou quand l'hôte clique sur « Lancer à N ».

> L'hôte (celui qui crée la partie) fait tourner le jeu : il doit garder la page ou l'appli ouverte pendant la partie.

## Clé de traduction OpenAI intégrée

Pour que la traduction OpenAI marche pour tout le monde, quel que soit l'hôte :

1. Va dans *Settings → Secrets and variables → Actions → New repository secret*.
2. Mets **`OPENAI_API_KEY`** comme nom et ta clé `sk-...` comme valeur.
3. Relance le workflow « Site web (GitHub Pages) » depuis l'onglet *Actions* (bouton *Run workflow*).

La clé n'est jamais écrite dans le code du dépôt : elle est ajoutée (encodée) seulement dans la version publiée. Elle reste cependant récupérable par quelqu'un de très motivé qui fouillerait la page. **Mets donc une limite de dépense** sur ton compte OpenAI (*Settings → Limits*).

## Modifier le jeu

Les sources sont dans `src/`. Lance `python3 tools/build.py` pour régénérer `index.html`.

## Comment ça marche (technique)

- Un seul fichier `index.html`, sans serveur à soi. Les messages passent par un relais MQTT public gratuit (EMQX, avec HiveMQ en secours) et sont **chiffrés** (AES-GCM avec la clé de partie contenue dans le lien, plus ECDH entre chaque joueur et l'hôte pour les infos secrètes).
- La clé OpenAI éventuelle reste **uniquement** dans le stockage local de l'appareil de l'hôte. Elle n'est jamais envoyée aux autres joueurs ni sur GitHub.
- Appli de bureau : `desktop/` (Electron). Pour la construire, pousse un tag `v1.0.0` : GitHub Actions génère les installateurs.

---

# 🌕 Hurlune — Оборотни с друзьями

Онлайн-игра «Оборотни» для друзей из Франции и России:

- **Без регистрации.**
- **Перевод чата одной кнопкой** (🌐).
- **Интерфейс на русском и французском.**
- **29 ролей.**

Играть в браузере: https://adelinenzy.github.io/hurlune/. Приложение для компьютера можно скачать во вкладке *Releases*.
