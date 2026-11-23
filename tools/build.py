import re,sys
import os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src=os.path.join(ROOT,'src')+'/'
css=open(src+'style.css').read()
js='\n'.join(open(src+f).read() for f in ['roles.js','net.js','engine.js','art.js','emblems.js','i18n.js','audio.js','village3d.js','scene4_core.js','scene4_chars.js','scene4_world.js','scene4_main.js','ui.js'])
html=f'''<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hurlune — Loups-Garous entre amis · Оборотни</title>
<meta name="description" content="Jeu de Loups-Garous en ligne entre amis, sans compte, chat traduisible français / russe.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Philosopher:wght@400;700&display=swap" rel="stylesheet">
<style>
{css}
</style>
</head>
<body>
<div id="app"></div>
<script>
"use strict";
{js}
</script>
</body>
</html>
'''
open(os.path.join(ROOT,'index.html'),'w').write(html)
print('built', len(html))
