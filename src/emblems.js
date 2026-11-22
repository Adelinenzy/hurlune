/* ===================== ROLE EMBLEMS & CARDS (original SVG art) ===================== */
const EM = {};
(function(){
  const sh=(d,c,o)=>`<path d="${d}" fill="${c}"${o!=null?` opacity="${o}"`:""}/>`;
  function wolf(fur,dark,light,eye,extra=""){
    return `
    ${sh("M20 14 L40 38 L28 46Z",dark)}${sh("M80 14 L60 38 L72 46Z",dark)}
    ${sh("M25 21 L36 37 L30 41Z","#000",.25)}${sh("M75 21 L64 37 L70 41Z","#000",.25)}
    ${sh("M50 28 C71 28 82 43 80 58 C78 71 65 83 50 90 C35 83 22 71 20 58 C18 43 29 28 50 28Z",fur)}
    ${sh("M50 28 C71 28 82 43 80 58 C78 71 65 83 50 90Z","#000",.16)}
    ${sh("M20 58 L12 64 L22 66Z M80 58 L88 64 L78 66Z",fur)}
    ${sh("M50 50 C60 50 66 60 64 72 C62 80 56 86 50 88 C44 86 38 80 36 72 C34 60 40 50 50 50Z",light)}
    ${sh("M44 63 Q50 59 56 63 Q50 69 44 63Z","#16161e")}
    ${sh("M50 69 L50 75 M50 75 Q45 79 41 76 M50 75 Q55 79 59 76","none")}
    <path d="M50 69 L50 75 M50 75 Q45 79 41 76 M50 75 Q55 79 59 76" stroke="#16161e" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${sh("M30 49 L44 53 L32 57Z",eye)}${sh("M70 49 L56 53 L68 57Z",eye)}
    <circle cx="36" cy="53" r="1.8" fill="#111"/><circle cx="64" cy="53" r="1.8" fill="#111"/>
    ${sh("M32 44 L44 48 M68 44 L56 48","none")}<path d="M31 45 L44 49 M69 45 L56 49" stroke="#000" stroke-opacity=".35" stroke-width="2.5" stroke-linecap="round"/>
    ${extra}`;
  }
  const moon=`<circle cx="50" cy="50" r="46" fill="#000" opacity=".0"/>`;
  function hood(col,dark,face,inner=""){
    return `${sh("M50 10 C73 10 85 33 82 55 L90 94 L10 94 L18 55 C15 33 27 10 50 10Z",col)}
    ${sh("M50 10 C73 10 85 33 82 55 L90 94 L50 94Z","#000",.18)}
    ${sh("M50 26 C64 26 70 38 69 52 C68 66 60 74 50 74 C40 74 32 66 31 52 C30 38 36 26 50 26Z","#000",.35)}
    ${face||`${sh("M50 30 C61 30 66 40 65 52 C64 63 58 70 50 70 C42 70 36 63 35 52 C34 40 39 30 50 30Z","#f2c9a5")}
      ${sh("M50 30 C61 30 66 40 65 52 C64 63 58 70 50 70Z","#000",.1)}
      <circle cx="44" cy="51" r="2.6" fill="#2a1d15"/><circle cx="56" cy="51" r="2.6" fill="#2a1d15"/>
      <circle cx="40" cy="58" r="3" fill="#ff8a8a" opacity=".5"/><circle cx="60" cy="58" r="3" fill="#ff8a8a" opacity=".5"/>
      <path d="M46 61 Q50 64 54 61" stroke="#8a4a3a" stroke-width="2" fill="none" stroke-linecap="round"/>`}
    ${sh("M44 76 L50 86 L56 76Z",dark)}${inner}`;
  }
  function orb(col,glow,extra=""){
    return `<ellipse cx="50" cy="86" rx="26" ry="6" fill="#000" opacity=".3"/>
    ${sh("M30 88 L36 72 L64 72 L70 88Z","#7a5a3a")}${sh("M50 72 L64 72 L70 88 L50 88Z","#000",.2)}
    <circle cx="50" cy="46" r="31" fill="${glow}" opacity=".25"/>
    <circle cx="50" cy="46" r="26" fill="${col}"/>
    <path d="M50 20 A26 26 0 0 1 50 72 A20 26 0 0 0 50 20Z" fill="#000" opacity=".18"/>
    <ellipse cx="41" cy="36" rx="8" ry="5" fill="#fff" opacity=".55" transform="rotate(-30 41 36)"/>
    <path d="M52 40 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#fff" opacity=".9"/>${extra}`;
  }
  function bottle(x,y,s,liq,deco=""){
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-6" y="-46" width="12" height="16" rx="2" fill="#cfd6e6"/><rect x="-8" y="-52" width="16" height="8" rx="2" fill="#8a5a3a"/>
      <path d="M-6 -32 C-26 -26 -30 -4 -22 8 C-14 20 14 20 22 8 C30 -4 26 -26 6 -32Z" fill="#dfe6f3" opacity=".9"/>
      <path d="M-25 -4 C-22 14 22 14 25 -4 C18 -8 -18 -8 -25 -4Z" fill="${liq}"/>
      <path d="M-23 -2 C-20 12 20 12 23 -2 C14 2 -14 2 -23 -2Z" fill="#000" opacity=".15"/>
      <ellipse cx="-12" cy="-16" rx="4" ry="9" fill="#fff" opacity=".6" transform="rotate(20 -12 -16)"/>${deco}</g>`;
  }
  const skull=(x,y,s,c="#f1efe6")=>`<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -14 C11 -14 16 -6 15 3 C14 8 10 10 9 14 L-9 14 C-10 10 -14 8 -15 3 C-16 -6 -11 -14 0 -14Z" fill="${c}"/><circle cx="-6" cy="1" r="4" fill="#222"/><circle cx="6" cy="1" r="4" fill="#222"/><path d="M-2 8 L0 5 L2 8Z" fill="#222"/><path d="M-6 14 v4 M0 14 v4 M6 14 v4" stroke="${c}" stroke-width="3"/></g>`;
  const bubble=`<g transform="translate(70 10)"><path d="M0 0 h26 a6 6 0 0 1 6 6 v12 a6 6 0 0 1 -6 6 h-14 l-8 7 v-7 h-4 a6 6 0 0 1 -6 -6 v-12 a6 6 0 0 1 6 -6z" fill="#fff"/><circle cx="7" cy="12" r="2.2" fill="#555"/><circle cx="14" cy="12" r="2.2" fill="#555"/><circle cx="21" cy="12" r="2.2" fill="#555"/></g>`;
  EM.werewolf=wolf("#8a8f9e","#5d6170","#c9ccd6","#ffd24a");
  EM.blackWolf=wolf("#2e2e3c","#1a1a24","#4d4d5e","#ff4545",`<circle cx="50" cy="12" r="0" />`);
  EM.whiteWolf=wolf("#eef0f6","#c6cad8","#ffffff","#5ac8ff");
  EM.talkativeWolf=wolf("#9a8670","#6e5d4b","#d6c7b2","#ffd24a",bubble);
  EM.literateWolf=wolf("#7e8796","#555c6a","#c3c8d2","#ffd24a",`<g transform="translate(72 44) rotate(30)"><path d="M0 0 C10 -10 16 -26 6 -36 C4 -20 -2 -10 -4 0Z" fill="#f3efe2"/><path d="M0 0 L-2 14" stroke="#3a2a1a" stroke-width="3" stroke-linecap="round"/></g>`);
  EM.wolfRidingHood=hood("#8e1d2c","#5c121c",`${sh("M38 34 L44 44 L36 46Z M62 34 L56 44 L64 46Z","#4a4d5a")}${sh("M50 34 C62 34 67 44 66 54 C65 64 58 72 50 74 C42 72 35 64 34 54 C33 44 38 34 50 34Z","#7d8190")}${sh("M50 52 C56 52 59 58 58 64 C57 69 54 72 50 73 C46 72 43 69 42 64 C41 58 44 52 50 52Z","#c9ccd6")}${sh("M46 60 Q50 57 54 60 Q50 64 46 60Z","#111")}${sh("M38 48 L46 50 L39 53Z M62 48 L54 50 L61 53Z","#ffd24a")}`);
  EM.mercenary=`<circle cx="50" cy="50" r="38" fill="none" stroke="#c94a4a" stroke-width="5"/><circle cx="50" cy="50" r="24" fill="none" stroke="#c94a4a" stroke-width="5"/><circle cx="50" cy="50" r="9" fill="#c94a4a"/>
    <g transform="rotate(-40 50 50)"><path d="M47 8 L53 8 L55 56 L45 56Z" fill="#dfe4ee"/><path d="M50 8 L53 8 L55 56 L50 56Z" fill="#000" opacity=".15"/><rect x="36" y="56" width="28" height="6" rx="3" fill="#c9a24a"/><rect x="46" y="62" width="8" height="20" rx="3" fill="#5a3a22"/><circle cx="50" cy="86" r="5" fill="#c9a24a"/></g>`;
  EM.sickRat=`<ellipse cx="50" cy="88" rx="30" ry="5" fill="#000" opacity=".3"/>
    <path d="M78 74 C92 70 96 84 86 88" stroke="#c98a8a" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M22 66 C22 46 40 36 58 38 C74 40 82 54 80 68 C78 80 64 86 48 86 C32 86 22 80 22 66Z" fill="#8a8f80"/>
    <path d="M58 38 C74 40 82 54 80 68 C78 80 64 86 48 86Z" fill="#000" opacity=".15"/>
    <path d="M30 52 C20 50 10 56 8 62 C14 66 24 66 32 62Z" fill="#9aa08f"/><circle cx="9" cy="61" r="3" fill="#e08a9a"/>
    <circle cx="36" cy="42" r="10" fill="#b5ba9f"/><circle cx="36" cy="42" r="6" fill="#e0a8b0"/>
    <circle cx="24" cy="54" r="3" fill="#1b1b1b"/><circle cx="25" cy="53" r="1" fill="#fff"/>
    <circle cx="54" cy="58" r="5" fill="#7bd88f" opacity=".8"/><circle cx="66" cy="70" r="4" fill="#7bd88f" opacity=".8"/><circle cx="46" cy="74" r="3.5" fill="#7bd88f" opacity=".8"/>
    <path d="M14 60 l-10 -4 M14 62 l-11 2" stroke="#555" stroke-width="1.2"/>`;
  EM.villager=`<ellipse cx="50" cy="90" rx="36" ry="5" fill="#000" opacity=".3"/>
    <path d="M18 50 L50 22 L82 50Z" fill="#a8452f"/><path d="M50 22 L82 50 L50 50Z" fill="#000" opacity=".2"/>
    <rect x="24" y="48" width="52" height="40" fill="#e8d4b0"/><rect x="50" y="48" width="26" height="40" fill="#000" opacity=".12"/>
    <rect x="44" y="64" width="13" height="24" rx="2" fill="#6b4226"/>
    <rect x="29" y="56" width="11" height="11" fill="#ffd77a"/><path d="M34.5 56 v11 M29 61.5 h11" stroke="#6b4226" stroke-width="1.5"/>
    <rect x="62" y="56" width="10" height="10" fill="#ffd77a" opacity=".9"/>
    <rect x="64" y="26" width="7" height="14" fill="#7a3a2a"/><path d="M67 22 q4 -6 0 -10 q-4 -4 0 -8" stroke="#ccc" stroke-width="2.5" fill="none" opacity=".7"/>`;
  EM.seer=orb("#7d5cf0","#b9a6ff");
  EM.talkativeSeer=orb("#e06db5","#ffb3e6",bubble);
  EM.auraSeer=orb("#f2b84b","#ffe9a8",`<circle cx="50" cy="46" r="36" fill="none" stroke="#ffe08a" stroke-width="2" stroke-dasharray="4 5"/><circle cx="50" cy="46" r="42" fill="none" stroke="#ffe08a" stroke-width="1.5" stroke-dasharray="2 6" opacity=".7"/>`);
  EM.witch=`<ellipse cx="50" cy="90" rx="34" ry="5" fill="#000" opacity=".3"/>${bottle(32,72,.85,"#5bd08a",`<path d="M-4 -4 h8 M0 -8 v8" stroke="#fff" stroke-width="3"/>`)}${bottle(68,74,.85,"#9b5cf0",skull(0,-2,.45))}`;
  EM.healerWitch=`<ellipse cx="50" cy="90" rx="30" ry="5" fill="#000" opacity=".3"/>${bottle(50,74,1.15,"#5bd08a",`<path d="M0 6 C-10 -2 -8 -12 0 -6 C8 -12 10 -2 0 6Z" fill="#fff"/>`)}`;
  EM.poisoner=`<ellipse cx="50" cy="90" rx="30" ry="5" fill="#000" opacity=".3"/>${bottle(50,74,1.15,"#9b5cf0",skull(0,-1,.5))}<circle cx="70" cy="22" r="4" fill="#9b5cf0" opacity=".7"/><circle cx="78" cy="14" r="2.5" fill="#9b5cf0" opacity=".6"/>`;
  EM.hunter=`<path d="M28 12 C70 24 72 76 28 88" stroke="#7a4a2a" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M28 12 C70 24 72 76 28 88" stroke="#000" stroke-opacity=".2" stroke-width="3" fill="none" transform="translate(2 0)"/>
    <path d="M28 12 L28 88" stroke="#e8e0cc" stroke-width="1.8"/>
    <g transform="rotate(-35 50 50)"><rect x="8" y="48" width="78" height="4" rx="2" fill="#c9a26a"/><path d="M86 44 L98 50 L86 56Z" fill="#cfd6e6"/><path d="M8 50 L18 42 L22 42 L14 50 L22 58 L18 58Z" fill="#d9534f"/></g>`;
  EM.guard=`<ellipse cx="50" cy="92" rx="26" ry="4" fill="#000" opacity=".3"/>
    <path d="M50 8 L84 18 C84 52 72 78 50 92 C28 78 16 52 16 18Z" fill="#3f6fb0"/><path d="M50 8 L84 18 C84 52 72 78 50 92Z" fill="#000" opacity=".2"/>
    <path d="M50 16 L76 24 C76 52 66 72 50 83 C34 72 24 52 24 24Z" fill="none" stroke="#d8c27a" stroke-width="3"/>
    <path d="M46 28 h8 v14 h14 v8 h-14 v22 h-8 v-22 h-14 v-8 h14z" fill="#e8e8f2"/>`;
  EM.littleGirl=`${sh("M30 38 C16 40 12 56 18 70 C22 62 24 54 30 50Z","#6b3a22")}${sh("M70 38 C84 40 88 56 82 70 C78 62 76 54 70 50Z","#6b3a22")}
    <circle cx="16" cy="72" r="6" fill="#e05a7a"/><circle cx="84" cy="72" r="6" fill="#e05a7a"/>
    ${sh("M50 22 C68 22 76 38 74 56 C72 72 62 84 50 84 C38 84 28 72 26 56 C24 38 32 22 50 22Z","#f2c9a5")}
    ${sh("M50 22 C68 22 76 38 74 56 C72 72 62 84 50 84Z","#000",.08)}
    ${sh("M26 46 C26 26 40 16 50 16 C62 16 76 26 74 46 C66 36 58 34 50 40 C44 34 34 36 26 46Z","#7a4428")}
    <ellipse cx="41" cy="56" rx="4.5" ry="5.5" fill="#2a1d15"/><ellipse cx="59" cy="56" rx="4.5" ry="5.5" fill="#2a1d15"/><circle cx="42.5" cy="54" r="1.6" fill="#fff"/><circle cx="60.5" cy="54" r="1.6" fill="#fff"/>
    <circle cx="35" cy="66" r="4" fill="#ff8a9a" opacity=".55"/><circle cx="65" cy="66" r="4" fill="#ff8a9a" opacity=".55"/>
    <path d="M45 70 Q50 74 55 70" stroke="#a0503a" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  EM.cupid=`<path d="M22 40 C8 30 6 14 18 12 C26 10 30 18 28 26 C34 18 30 30 22 40Z" fill="#fff" opacity=".85"/><path d="M78 40 C92 30 94 14 82 12 C74 10 70 18 72 26 C66 18 70 30 78 40Z" fill="#fff" opacity=".85"/>
    <path d="M50 86 C20 66 14 48 22 36 C30 24 46 28 50 40 C54 28 70 24 78 36 C86 48 80 66 50 86Z" fill="#e8457a"/><path d="M50 40 C54 28 70 24 78 36 C86 48 80 66 50 86Z" fill="#000" opacity=".15"/>
    <ellipse cx="34" cy="42" rx="6" ry="4" fill="#fff" opacity=".45" transform="rotate(-30 34 42)"/>
    <g transform="rotate(-25 50 55)"><rect x="4" y="53" width="92" height="4" rx="2" fill="#c9a26a"/><path d="M96 49 L106 55 L96 61Z" fill="#f2d16b"/><path d="M4 55 L14 47 L18 47 L10 55 L18 63 L14 63Z" fill="#fff"/></g>`;
  EM.redRidingHood=hood("#d23a3a","#8a1f1f");
  EM.pinkRidingHood=hood("#ec7ab5","#a84a7e");
  EM.blueRidingHood=hood("#3f7fd6","#25508f");
  EM.mentalist=`<circle cx="50" cy="50" r="40" fill="#2d2350"/><path d="M50 14 A36 36 0 0 1 86 50 A36 36 0 0 1 50 86" fill="none" stroke="#a58bf0" stroke-width="2" stroke-dasharray="3 5"/>
    <path d="M14 50 C26 30 74 30 86 50 C74 70 26 70 14 50Z" fill="#f3f0ff"/><circle cx="50" cy="50" r="13" fill="#7d5cf0"/><circle cx="50" cy="50" r="6" fill="#16121f"/><circle cx="46" cy="46" r="3" fill="#fff"/>
    <path d="M50 10 v8 M50 82 v8 M10 50 h8 M82 50 h8" stroke="#c8b8ff" stroke-width="3" stroke-linecap="round"/>`;
  EM.necromancer=`<ellipse cx="50" cy="50" rx="40" ry="40" fill="#7d5cf0" opacity=".18"/>${skull(46,48,2.1,"#ece9df")}
    <rect x="76" y="54" width="9" height="30" rx="2" fill="#e8dcc0"/><path d="M80.5 54 C74 46 80 38 80.5 34 C82 40 88 46 80.5 54Z" fill="#a58bf0"/><path d="M80.5 52 C78 47 80 43 80.5 41 C82 44 83 48 80.5 52Z" fill="#fff"/>`;
  EM.gravedigger=`<ellipse cx="50" cy="90" rx="36" ry="5" fill="#000" opacity=".3"/>
    <path d="M30 88 V46 C30 28 70 28 70 46 V88Z" fill="#8a8ea0"/><path d="M50 32 C62 33 70 38 70 46 V88 H50Z" fill="#000" opacity=".18"/>
    <path d="M45 46 h10 M50 41 v18" stroke="#5a5e70" stroke-width="4" stroke-linecap="round"/>
    <path d="M20 88 C30 80 70 80 80 88Z" fill="#5a4030"/>
    <g transform="rotate(30 74 40)"><rect x="71" y="6" width="6" height="52" rx="2" fill="#7a5030"/><rect x="66" y="4" width="16" height="5" rx="2" fill="#7a5030"/><path d="M64 56 h20 l-2 18 c-2 6 -14 6 -16 0z" fill="#b8c0cc"/></g>`;
  EM.dictator=`<path d="M26 52 C14 44 12 26 20 16 M74 52 C86 44 88 26 80 16" stroke="#4a8a4a" stroke-width="4" fill="none"/>${[0,1,2,3].map(i=>`<ellipse cx="${18+i*1}" cy="${46-i*9}" rx="6" ry="3" fill="#5ba85b" transform="rotate(${-40-i*12} ${18+i} ${46-i*9})"/><ellipse cx="${82-i*1}" cy="${46-i*9}" rx="6" ry="3" fill="#5ba85b" transform="rotate(${40+i*12} ${82-i} ${46-i*9})"/>`).join("")}
    <path d="M38 58 L32 92 L42 86 L46 94 L50 60Z M62 58 L68 92 L58 86 L54 94 L50 60Z" fill="#c94a4a"/>
    <circle cx="50" cy="48" r="22" fill="#e8b84a"/><circle cx="50" cy="48" r="22" fill="none" stroke="#b58a2a" stroke-width="3"/>
    <path d="M50 34 l4.5 9 10 1.4 -7.2 7 1.7 10 -9 -4.7 -9 4.7 1.7 -10 -7.2 -7 10 -1.4z" fill="#fff6d8"/>`;
  EM.heir=`<ellipse cx="50" cy="90" rx="34" ry="5" fill="#000" opacity=".3"/>
    <rect x="22" y="22" width="56" height="58" fill="#f0e2bf"/><rect x="50" y="22" width="28" height="58" fill="#000" opacity=".07"/>
    <rect x="16" y="14" width="68" height="12" rx="6" fill="#d9c08a"/><rect x="16" y="76" width="68" height="12" rx="6" fill="#d9c08a"/>
    <path d="M30 36 h40 M30 44 h36 M30 52 h40 M30 60 h24" stroke="#8a7350" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="66" cy="66" r="10" fill="#c23a3a"/><path d="M62 66 l3 3 6 -6" stroke="#fff" stroke-width="2.4" fill="none"/><path d="M60 74 l-3 12 5 -3 3 4 2 -12Z" fill="#c23a3a"/>`;
  EM.plunderer=`<ellipse cx="50" cy="90" rx="34" ry="5" fill="#000" opacity=".3"/>
    <path d="M36 30 C30 40 18 52 20 70 C22 86 78 86 80 70 C82 52 70 40 64 30Z" fill="#a0784a"/><path d="M50 30 H64 C70 40 82 52 80 70 C79 82 64 86 50 86Z" fill="#000" opacity=".18"/>
    <path d="M36 30 C40 24 60 24 64 30 C58 34 42 34 36 30Z" fill="#7a5530"/><path d="M38 28 L32 16 M50 26 L50 12 M62 28 L68 16" stroke="#7a5530" stroke-width="3" stroke-linecap="round"/>
    <text x="50" y="68" font-size="22" text-anchor="middle" fill="#f5d46a" font-weight="900" font-family="Arial">$</text>
    ${[[22,84],[34,90],[72,86],[84,80]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="7" ry="4" fill="#f5c542"/><ellipse cx="${x}" cy="${y-1}" rx="5" ry="2.5" fill="#ffe08a"/>`).join("")}`;
  EM.pyromancer=`<ellipse cx="50" cy="92" rx="28" ry="4" fill="#000" opacity=".3"/>
    <path d="M28 52 C26 64 26 80 30 90 H70 C74 80 74 64 72 52Z" fill="#8a5a32"/><path d="M50 52 H72 C74 64 74 80 70 90 H50Z" fill="#000" opacity=".2"/>
    <path d="M27 60 H73 M27 80 H73" stroke="#4a4a52" stroke-width="4"/>
    <path d="M50 8 C58 20 74 26 70 44 C68 52 60 56 50 56 C40 56 32 52 30 44 C28 32 40 30 40 18 C46 24 46 30 50 32 C52 24 48 16 50 8Z" fill="#ff7a2a"/>
    <path d="M50 24 C55 32 62 36 60 46 C58 52 54 54 50 54 C46 54 42 52 40 46 C39 40 45 38 46 32 C48 36 50 36 50 24Z" fill="#ffd24a"/>`;
  for(const k in EM) EM[k]=`<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="emb">${EM[k]}</svg>`;
})();
function emb(r){ return EM[r]||EM.villager; }
const CAMP_GRAD={wolf:["#5a1620","#a8323f","#ff8f95"],village:["#173c63","#2f6fb0","#9fd0ff"],solo:["#5a4410","#b58a2a","#ffe08a"]};
function roleCardHTML(r,opts={}){
  const camp=opts.camp||ROLES[r].camp, g=CAMP_GRAD[camp]||CAMP_GRAD.village;
  return `<div class="rcard ${opts.small?"small":""} camp-${camp}" style="--g1:${g[0]};--g2:${g[1]};--g3:${g[2]}">
    <div class="rc-in"><div class="rc-frame"></div><div class="rc-camp">${esc(t("camp_"+camp))}</div>
    <div class="rc-art">${emb(r)}</div><div class="rc-name">${esc(roleName(r))}</div>${opts.small?"":`<div class="rc-desc">${esc(roleDesc(r))}</div>`}</div></div>`;
}
function cardBackHTML(){
  return `<div class="rcard back"><div class="rc-in"><div class="rc-frame"></div><div class="rc-back-art">${logoSVG()}</div><div class="rc-back-t">Hurlune</div></div></div>`;
}
