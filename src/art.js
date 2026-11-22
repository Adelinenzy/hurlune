/* ===================== ART (original SVG) ===================== */
function sceneSVG(){
  let stars="";
  const rnd=(i)=>{ const x=Math.sin(i*999.13)*10000; return x-Math.floor(x); };
  for(let i=0;i<90;i++){ const x=rnd(i)*1600, y=rnd(i+300)*430, r=rnd(i+600)*1.4+0.4; stars+=`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(2)}" fill="#fff" opacity="${(0.35+rnd(i+900)*0.65).toFixed(2)}"/>`; }
  const pine=(x,y,s,c)=>`<g transform="translate(${x} ${y}) scale(${s})"><rect x="-4" y="-10" width="8" height="22" fill="var(--trunk)"/><path d="M0 -150 L34 -80 L18 -82 L46 -30 L24 -32 L56 18 L-56 18 L-24 -32 L-46 -30 L-18 -82 L-34 -80Z" fill="${c}"/></g>`;
  let trees="";
  [[60,640,1.5],[150,670,1.15],[230,610,.9],[1500,650,1.5],[1420,680,1.1],[1350,620,.85],[1560,560,1.2],[30,560,1.1]].forEach(([x,y,s])=>trees+=pine(x,y,s,"var(--tree1)"));
  [[330,560,.6],[400,575,.5],[1240,565,.6],[1180,580,.45],[460,560,.42],[1110,560,.4]].forEach(([x,y,s])=>trees+=pine(x,y,s,"var(--tree2)"));
  return `<svg class="scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sky1)"/><stop offset=".6" style="stop-color:var(--sky2)"/><stop offset="1" style="stop-color:var(--sky3)"/></linearGradient>
    <radialGradient id="moonG" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#f4f1e6"/><stop offset="1" stop-color="#bdb9ad"/></radialGradient>
    <radialGradient id="glowG"><stop offset="0" style="stop-color:var(--glow)" stop-opacity=".55"/><stop offset="1" style="stop-color:var(--glow)" stop-opacity="0"/></radialGradient>
    <linearGradient id="lakeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--lake1)"/><stop offset="1" style="stop-color:var(--lake2)"/></linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#skyG)"/>
  <g class="stars">${stars}</g>
  <g class="clouds"><g class="cl c1"><ellipse cx="200" cy="140" rx="90" ry="26" fill="#fff"/><ellipse cx="250" cy="120" rx="60" ry="34" fill="#fff"/><ellipse cx="160" cy="128" rx="44" ry="24" fill="#fff"/></g>
   <g class="cl c2"><ellipse cx="1100" cy="190" rx="110" ry="28" fill="#fff"/><ellipse cx="1160" cy="168" rx="64" ry="36" fill="#fff"/><ellipse cx="1050" cy="176" rx="50" ry="26" fill="#fff"/></g>
   <g class="cl c3"><ellipse cx="760" cy="90" rx="70" ry="18" fill="#fff"/><ellipse cx="800" cy="76" rx="40" ry="22" fill="#fff"/></g></g>
  <circle cx="560" cy="250" r="260" fill="url(#glowG)"/>
  <g class="moon"><circle cx="560" cy="250" r="140" fill="url(#moonG)"/>
    <circle cx="510" cy="215" r="26" fill="#a9a597" opacity=".55"/><circle cx="600" cy="300" r="34" fill="#a9a597" opacity=".45"/><circle cx="620" cy="200" r="14" fill="#a9a597" opacity=".5"/><circle cx="480" cy="300" r="18" fill="#a9a597" opacity=".4"/><path d="M450 240 q40 -30 70 10 q30 30 60 0" stroke="#a9a597" stroke-width="10" fill="none" opacity=".35"/></g>
  <g class="sun"><circle cx="560" cy="250" r="110" fill="#ffd77a"/><circle cx="560" cy="250" r="150" fill="#ffd77a" opacity=".25"/></g>
  <path d="M0 520 L140 380 L260 450 L420 300 L560 430 L700 340 L860 470 L1000 330 L1150 420 L1290 290 L1440 410 L1600 330 L1600 900 L0 900Z" fill="var(--mount3)"/>
  <path d="M0 560 L200 440 L330 500 L520 400 L690 520 L880 420 L1060 520 L1240 410 L1400 500 L1600 420 L1600 900 L0 900Z" fill="var(--mount2)"/>
  <path d="M420 300 L470 345 L440 340 L420 370 L400 335 L380 342Z M1290 290 L1330 330 L1305 326 L1290 350 L1272 324 L1250 330Z" fill="#fff" opacity="var(--snow)"/>
  <path d="M0 600 C200 560 380 590 560 575 C760 560 980 590 1180 572 C1360 556 1500 580 1600 570 L1600 900 L0 900Z" fill="var(--hill)"/>
  <ellipse cx="800" cy="640" rx="430" ry="46" fill="url(#lakeG)"/>
  <g opacity=".6" stroke="var(--shine)" stroke-width="3" stroke-linecap="round"><line x1="1010" y1="628" x2="1080" y2="628"/><line x1="1030" y1="642" x2="1120" y2="642"/></g>
  ${trees}
  <path d="M0 700 C300 660 600 690 800 680 C1050 670 1300 690 1600 670 L1600 900 L0 900Z" fill="var(--ground)"/>
  <path d="M0 780 C400 750 800 770 1600 750 L1600 900 L0 900Z" fill="var(--ground2)"/>
  </svg>`;
}

const SKIN=["#f5d0b0","#e8b48a","#c98e62","#8d5a3b","#f1c6a2","#5c3a26"];
const HAIRC=["#2a1d15","#5a3a22","#c9a15a","#e6d28f","#a33a2a","#d9d9de","#3b3f8f","#e07fb0"];
const TOPC=["#2f4a8f","#7a2f3a","#3f6e4a","#5b3f86","#8a6a2f","#2e2e3a","#c35a3a","#2f7a8a","#d0d0dc","#9c3d7a"];
function randomAvatar(){ const r=n=>Math.floor(Math.random()*n); return {s:r(SKIN.length),h:r(6),hc:r(HAIRC.length),t:r(TOPC.length),o:r(4),a:r(5)}; }
function shade(hex,f){ const n=parseInt(hex.slice(1),16); let r=n>>16,g=(n>>8)&255,b=n&255; r=Math.round(r*f);g=Math.round(g*f);b=Math.round(b*f); const c=x=>Math.max(0,Math.min(255,x)).toString(16).padStart(2,"0"); return "#"+c(r)+c(g)+c(b); }
function charSVG(av,opt={}){
  av=av||{s:0,h:0,hc:0,t:0,o:0,a:0};
  const sk=SKIN[av.s%SKIN.length], hc=HAIRC[av.hc%HAIRC.length], tc=TOPC[av.t%TOPC.length], tcd=shade(tc,.72), skd=shade(sk,.86);
  const eyes = opt.sleep ? `<path d="M41 47 q4 3 8 0 M55 47 q4 3 8 0" stroke="#3a2a22" stroke-width="2" fill="none" stroke-linecap="round"/>`
                         : `<circle cx="45" cy="47" r="2.6" fill="#2a1d15"/><circle cx="59" cy="47" r="2.6" fill="#2a1d15"/>`;
  let body="";
  switch(av.o%4){
    case 0: body=`<path d="M30 74 h44 l4 52 h-52z" fill="${tc}"/><path d="M52 74 h22 l4 52 h-26z" fill="${tcd}"/><path d="M46 74 l6 14 l6 -14z" fill="#eee"/>${[88,98,108].map(y=>`<circle cx="49" cy="${y}" r="1.8" fill="#d8c27a"/><circle cx="56" cy="${y}" r="1.8" fill="#d8c27a"/>`).join("")}`; break;
    case 1: body=`<path d="M34 74 h36 l14 60 h-64z" fill="${tc}"/><path d="M52 74 h18 l14 60 h-32z" fill="${tcd}"/><rect x="34" y="92" width="36" height="5" fill="${shade(tc,.5)}"/>`; break;
    case 2: body=`<path d="M31 74 h42 l3 50 h-48z" fill="${tc}"/><path d="M52 74 h21 l3 50 h-24z" fill="${tcd}"/><rect x="29" y="100" width="46" height="7" fill="#6b4a2a"/><rect x="48" y="99" width="8" height="9" fill="#d8c27a"/>`; break;
    case 3: body=`<path d="M26 76 q26 -8 52 0 l8 58 h-68z" fill="${tc}"/><path d="M52 72 q13 0 26 4 l8 58 h-34z" fill="${tcd}"/><path d="M44 74 l8 10 l8 -10" stroke="#eee" stroke-width="3" fill="none"/>`; break;
  }
  const legs = av.o%4===1 ? `<rect x="40" y="132" width="8" height="12" fill="#2a2630"/><rect x="56" y="132" width="8" height="12" fill="#2a2630"/>`
                          : `<rect x="36" y="124" width="13" height="22" fill="#26232e"/><rect x="55" y="124" width="13" height="22" fill="#1d1b24"/>`;
  const shoes=`<rect x="33" y="143" width="17" height="6" rx="3" fill="#15131a"/><rect x="54" y="143" width="17" height="6" rx="3" fill="#15131a"/>`;
  const arms=`<rect x="22" y="78" width="10" height="40" rx="5" fill="${tc}"/><rect x="72" y="78" width="10" height="40" rx="5" fill="${tcd}"/><circle cx="27" cy="120" r="5" fill="${sk}"/><circle cx="77" cy="120" r="5" fill="${skd}"/>`;
  const head=`<rect x="34" y="22" width="36" height="50" rx="16" fill="${sk}"/><path d="M52 22 h2 a16 16 0 0 1 16 16 v18 a16 16 0 0 1 -16 16 h-2z" fill="${skd}"/>${eyes}<path d="M52 52 q2 5 0 9" stroke="${shade(sk,.7)}" stroke-width="2" fill="none"/>`;
  let hair="";
  switch(av.h%6){
    case 0: hair=`<path d="M33 40 q0 -22 19 -22 q19 0 19 22 q-6 -12 -19 -12 q-13 0 -19 12z" fill="${hc}"/>`; break;
    case 1: hair=`<path d="M31 46 v-10 q0 -20 21 -20 q21 0 21 20 v10 h-6 v-14 h-30 v14z" fill="${hc}"/>`; break;
    case 2: hair=`<path d="M30 80 v-42 q0 -22 22 -22 q22 0 22 22 v42 h-8 v-44 q-14 -8 -28 0 v44z" fill="${hc}"/>`; break;
    case 3: hair=`<path d="M33 36 l3 -16 l6 8 l5 -12 l6 10 l6 -11 l4 12 l7 -7 l1 16 q-19 -8 -38 0z" fill="${hc}"/>`; break;
    case 4: hair=`<circle cx="52" cy="14" r="9" fill="${hc}"/><path d="M33 40 q0 -22 19 -22 q19 0 19 22 q-19 -14 -38 0z" fill="${hc}"/>`; break;
    case 5: hair=``; break;
  }
  let hat="";
  switch(av.a%5){
    case 1: hat=`<rect x="30" y="18" width="44" height="5" rx="2" fill="#1a1820"/><rect x="38" y="-4" width="28" height="24" rx="3" fill="#22202a"/><rect x="38" y="12" width="28" height="4" fill="#7a2f3a"/>`; break;
    case 2: hat=`<path d="M28 60 q-2 -46 24 -46 q26 0 24 46 q-6 -30 -24 -30 q-18 0 -24 30z" fill="${shade(tc,.85)}"/>`; break;
    case 3: hat=`<circle cx="38" cy="22" r="5" fill="#f2a0c0"/><circle cx="48" cy="17" r="5" fill="#f7e17a"/><circle cx="58" cy="17" r="5" fill="#a0d8f2"/><circle cx="67" cy="22" r="5" fill="#f2a0c0"/>`; break;
    case 4: hat=`<ellipse cx="54" cy="22" rx="22" ry="7" fill="#3a2f5a"/><circle cx="60" cy="15" r="3" fill="#3a2f5a"/>`; break;
  }
  return `<svg viewBox="0 -8 104 160" class="ch-svg" xmlns="http://www.w3.org/2000/svg"><ellipse cx="52" cy="148" rx="30" ry="5" fill="#000" opacity=".28"/>${legs}${shoes}${arms}${body}${hair.includes("v-42")?hair:""}${head}${hair.includes("v-42")?"":hair}${hat}</svg>`;
}
function headSVG(av){
  av=av||{s:0,h:0,hc:0,t:0,o:0,a:0};
  return `<svg viewBox="22 0 60 80" class="hd-svg">${charSVG(av).replace(/^<svg[^>]*>/,"").replace(/<\/svg>$/,"")}</svg>`;
}
function isleSVG(){
  return `<svg viewBox="0 0 120 40" class="isle-svg"><path d="M6 10 C30 2 90 2 114 10 L100 22 C86 38 70 40 60 40 C46 40 30 36 20 22Z" fill="#4a3a30"/><path d="M60 8 C86 6 104 8 114 10 L100 22 C86 38 70 40 60 40Z" fill="#000" opacity=".22"/><path d="M4 10 C30 0 90 0 116 10 C96 16 24 16 4 10Z" fill="#4f8a4a"/><path d="M60 3 C88 3 108 6 116 10 C96 16 60 15 60 15Z" fill="#000" opacity=".12"/><path d="M20 10 l2 -5 2 5 M90 9 l2 -6 2 6 M70 12 l1.5 -4 1.5 4" stroke="#6fb066" stroke-width="1.5" fill="none"/></svg>`;
}
function tombSVG(){
  return `<svg viewBox="0 -8 104 160" class="ch-svg"><ellipse cx="52" cy="148" rx="34" ry="6" fill="#000" opacity=".3"/><path d="M26 146 v-60 q0 -30 26 -30 q26 0 26 30 v60z" fill="#6c6f80"/><path d="M52 56 q26 0 26 30 v60 h-26z" fill="#585a6a"/><circle cx="52" cy="94" r="12" fill="#c94a4a"/><circle cx="47.5" cy="92" r="3" fill="#2b1d22"/><circle cx="56.5" cy="92" r="3" fill="#2b1d22"/><rect x="48" y="100" width="8" height="5" rx="1" fill="#2b1d22"/><rect x="18" y="140" width="68" height="8" rx="3" fill="#3b4a3a"/></svg>`;
}
function logoSVG(){
  return `<svg viewBox="0 0 64 64" class="logo-svg"><circle cx="32" cy="32" r="30" fill="#14141f"/><path d="M40 10 a22 22 0 1 0 14 34 a18 18 0 1 1 -14 -34z" fill="#f2efe6"/><path d="M22 44 l4 -14 l3 5 l4 -10 l3 9 l4 -3 l-2 13z" fill="#14141f"/></svg>`;
}
