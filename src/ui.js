/* ===================== CLIENT / UI ===================== */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let LANG = (lsGet("lang"))||(()=>{ const n=(navigator.language||"").toLowerCase(); return n.startsWith("ru")?"ru":n.startsWith("fr")?"fr":"en"; })();
function t(k,p){ let s=(I18N[LANG]&&I18N[LANG][k])||I18N.fr[k]||k; if(p) for(const x in p) s=s.split("{"+x+"}").join(p[x]); return s; }
const roleName=r=>t("r_"+r), roleDesc=r=>t("d_"+r);

const APP = {
  me:null, room:null, host:null, st:null, v:{}, msgs:[], msgIds:new Set(), clockOff:0, view:"hub",
  set:Object.assign({sfx:true,amb:true,vol:.7,tr:false,theme:"forest",gq:"med"},lsGet("settings")||{}),
  ui:{panel:"chat",lovers:false,sel:[],modal:null,toast:null,joinErr:null,connecting:false,netStatus:"online",lastPhaseSeq:-1},
  game:null // {room,key,b}
};
function saveSettings(){ lsSet("settings",APP.set); }

/* ---------- identity ---------- */
async function ensureMe(){
  let me=lsGet("me");
  if(!me||!me.keys){ me={pid:rid(10),name:"",av:randomAvatar(),keys:await Crypto.genECDH()}; lsSet("me",me); }
  APP.me=me;
}
function saveMe(){ lsSet("me",APP.me); }

/* ---------- names / formatting ---------- */
function pl(id){ return APP.st&&APP.st.players.find(p=>p.id===id); }
function pname(id){ const p=pl(id); return p?p.n:"?"; }
function fmt(k,p){
  const out={};
  for(const x in (p||{})){ const v=p[x];
    if(v&&typeof v==="object"&&v.pid) out[x]=`<b class="mn" data-n="${esc(pname(v.pid))}">${esc(pname(v.pid))}</b>`;
    else if(v&&typeof v==="object"&&v.role) out[x]=`<b class="rl">${ROLES[v.role]?ROLES[v.role].icon:""} ${esc(roleName(v.role))}</b>`;
    else if(typeof v==="string"&&(v.startsWith("c_")||v.startsWith("aura"))) out[x]=esc(t(v));
    else out[x]=esc(v);
  }
  return t("m_"+k,out);
}
function now(){ return Date.now()+APP.clockOff; }

/* ---------- sound ---------- */
let AC=null;
function ac(){ if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return AC; }
function tone(c,T,{f=440,type="sine",d=.25,v=.18,glide=null,delay=0}){
  const o=c.createOscillator(),g=c.createGain(); o.type=type; o.frequency.setValueAtTime(f,T+delay); if(glide) o.frequency.exponentialRampToValueAtTime(glide,T+delay+d);
  g.gain.setValueAtTime(.0001,T+delay); g.gain.exponentialRampToValueAtTime(v,T+delay+.015); g.gain.exponentialRampToValueAtTime(.0001,T+delay+d);
  o.connect(g).connect(c.destination); o.start(T+delay); o.stop(T+delay+d+.05);
}
function sfx(kind){ if(APP.set.sfx===false||kind==="send") return; AUD.play(kind==="howl"?"night":kind); }
function sfxOld(kind){
  if(!APP.set.sound) return; const c=ac(); if(!c) return;
  try{
    const T=c.currentTime;
    if(kind==="tick"){ tone(c,T,{f:1250,type:"square",d:.05,v:.06}); return; }
    if(kind==="warn"){ tone(c,T,{f:880,type:"triangle",d:.35,v:.2}); tone(c,T,{f:660,type:"triangle",d:.45,v:.2,delay:.18}); tone(c,T,{f:880,type:"triangle",d:.5,v:.18,delay:.36}); return; }
    if(kind==="step"){ tone(c,T,{f:523,type:"sine",d:.6,v:.12}); tone(c,T,{f:784,type:"sine",d:.7,v:.08,delay:.08}); return; }
    if(kind==="vote"){ tone(c,T,{f:300,type:"triangle",d:.12,v:.15,glide:520}); return; }
    if(kind==="flip"){ const len=.35,b=c.createBuffer(1,c.sampleRate*len,c.sampleRate),d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.sin(Math.PI*i/d.length)*.6;
      const s=c.createBufferSource(); s.buffer=b; const f=c.createBiquadFilter(); f.type="bandpass"; f.frequency.setValueAtTime(800,T); f.frequency.exponentialRampToValueAtTime(3000,T+len); s.connect(f).connect(c.destination); s.start();
      tone(c,T,{f:660,d:.4,v:.12,delay:.25}); tone(c,T,{f:990,d:.6,v:.12,delay:.35}); return; }
    if(kind==="howl"){
      for(const [det,vol] of [[0,.16],[7,.07]]){
        const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter(),lfo=c.createOscillator(),lg=c.createGain();
        o.type="sawtooth"; f.type="lowpass"; f.frequency.value=1400; lfo.frequency.value=5.5; lg.gain.value=9; lfo.connect(lg).connect(o.frequency);
        o.frequency.setValueAtTime(320+det,T); o.frequency.exponentialRampToValueAtTime(610+det,T+.7); o.frequency.setValueAtTime(610+det,T+1.4); o.frequency.exponentialRampToValueAtTime(400+det,T+2.4);
        g.gain.setValueAtTime(.0001,T); g.gain.exponentialRampToValueAtTime(vol,T+.35); g.gain.setValueAtTime(vol,T+1.6); g.gain.exponentialRampToValueAtTime(.0001,T+2.5);
        o.connect(f).connect(g).connect(c.destination); o.start(T); lfo.start(T); o.stop(T+2.6); lfo.stop(T+2.6);
      } return; }
    if(kind==="day"){ [523,659,784,1047].forEach((f,i)=>tone(c,T,{f,type:"triangle",d:.5,v:.14,delay:i*.12})); return; }
    if(kind==="start"){ [392,523,659,784,659,784].forEach((f,i)=>tone(c,T,{f,type:"triangle",d:.35,v:.15,delay:i*.11})); return; }
    if(kind==="win"){ [523,659,784,1047,784,1047,1319].forEach((f,i)=>tone(c,T,{f,type:"triangle",d:.45,v:.16,delay:i*.13})); return; }
    if(kind==="thunder"){
      const len=1.8, b=c.createBuffer(1,c.sampleRate*len,c.sampleRate), d=b.getChannelData(0);
      for(let i=0;i<d.length;i++){ const e=Math.pow(1-i/d.length,2.2); d[i]=(Math.random()*2-1)*e*(i<c.sampleRate*.05?i/(c.sampleRate*.05):1); }
      const s=c.createBufferSource(); s.buffer=b; const f=c.createBiquadFilter(); f.type="lowpass"; f.frequency.value=420; const g=c.createGain(); g.gain.value=.9;
      s.connect(f).connect(g).connect(c.destination); s.start();
    } else {
      const o=c.createOscillator(), g=c.createGain(); o.type="triangle";
      const seq=kind==="mention"?[880,1320]:[660];
      g.gain.setValueAtTime(0.0001,T); g.gain.exponentialRampToValueAtTime(.18,T+.02); g.gain.exponentialRampToValueAtTime(.0001,T+.18*seq.length+.2);
      seq.forEach((f,i)=>o.frequency.setValueAtTime(f,T+i*.16)); o.connect(g).connect(c.destination); o.start(T); o.stop(T+.18*seq.length+.25);
    }
  }catch(e){}
}
document.addEventListener("pointerdown",()=>{ const c=ac(); if(c&&c.state==="suspended") c.resume(); },{once:false});

/* ---------- translation (Google, no account; MyMemory fallback) ---------- */
const TR={cache:new Map(),pending:new Set(),q:[],active:0,fail:0};
function trKey(x){ return LANG+"|"+x; }
function needTr(m){ return APP.set.tr&&m.x&&m.a!==APP.me.pid; }
function trGet(m){
  if(m.tr&&m.tr[LANG]!=null){ const x=m.tr[LANG]; return norm(x).trim()===norm(m.x).trim()?{same:1}:{x}; }
  if(S().oa&&Date.now()+APP.clockOff-(m.t||0)<15000) return null; // host translation (OpenAI) on its way
  return TR.cache.get(trKey(m.x));
}
function trRequest(m){
  const key=trKey(m.x); if(TR.cache.has(key)||TR.pending.has(key)) return;
  TR.pending.add(key); TR.q.push({x:m.x,L:LANG,key}); trPump();
}
async function trPump(){
  while(TR.active<3&&TR.q.length){
    const job=TR.q.shift(); TR.active++;
    trOne(job.x,job.L).then(r=>{ TR.cache.set(job.key,r); if(APP.view==="game"&&APP.ui.bubbles&&Object.values(APP.ui.bubbles).some(b=>b.until>Date.now()&&trKey(b.m.x)===job.key)) renderChars(); }).catch(()=>{ TR.cache.set(job.key,{fail:1}); })
      .finally(()=>{ TR.active--; TR.pending.delete(job.key); scheduleChat(); trPump(); });
  }
}
async function trOne(x,L){
  if(window.TEST_TRANSLATE) return window.TEST_TRANSLATE(x,L);
  try{
    const r=await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl="+L+"&dt=t&q="+encodeURIComponent(x));
    if(!r.ok) throw 0; const j=await r.json();
    const out=(j[0]||[]).map(s=>s[0]).join(""); const src=j[2];
    if(src===L) return {same:1}; return {x:out,src};
  }catch(e){
    const src=L==="ru"?(/[a-z]/i.test(x)&&!/[éèàçù]/i.test(x)?"en":"fr"):/[а-яё]/i.test(x)?"ru":L==="fr"?"en":"fr";
    const r=await fetch("https://api.mymemory.translated.net/get?langpair="+src+"|"+L+"&q="+encodeURIComponent(x));
    const j=await r.json(); const out=j&&j.responseData&&j.responseData.translatedText;
    if(!out) throw 0; if(out.trim().toLowerCase()===x.trim().toLowerCase()) return {same:1};
    return {x:out,src};
  }
}

/* ---------- OpenAI translation (host only, key stays on this computer) ---------- */
const BUILTIN_OA="__HURLUNE_OA__";
function builtinKey(){ try{ if(BUILTIN_OA.startsWith("__")) return ""; return atob(BUILTIN_OA).split("").reverse().join(""); }catch(e){ return ""; } }
function oaKey(){ return (lsGet("oaKey")||"").trim()||builtinKey(); }
function oaModel(){ return (lsGet("oaModel")||"gpt-5.6-luna").trim(); }
async function openaiTranslate(x,langs){
  const key=oaKey(); if(!key||!langs.length) return null;
  const names={fr:"French",ru:"Russian",en:"English"};
  const body=m=>({model:m,response_format:{type:"json_object"},messages:[
    {role:"system",content:"You translate chat messages of an online Werewolf (Loup-Garou / Оборотни) party game played by French and Russian friends. Keep the casual tone, slang, jokes, emojis, @mentions and player names. Return ONLY a JSON object whose keys are the requested language codes and whose values are the translation of the message into that language (if the message is already in that language, return it unchanged)."},
    {role:"user",content:JSON.stringify({languages:langs.map(l=>l+" ("+names[l]+")"),message:x})}]});
  const call=async m=>{ const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify(body(m))});
    if(!r.ok){ const e=new Error("openai "+r.status); e.status=r.status; e.txt=await r.text().catch(()=>""); throw e; } const j=await r.json(); return JSON.parse(j.choices[0].message.content); };
  let out;
  try{ out=await call(oaModel()); }
  catch(e){ if(e.status===404||e.status===400){ out=await call("gpt-4.1-nano"); } else { APP.oaErr=e.status||"net"; throw e; } }
  APP.oaErr=null;
  const res={}; for(const l of langs) if(typeof out[l]==="string") res[l]=out[l];
  return res;
}
function hostTranslator(){ return oaKey()?openaiTranslate:null; }
async function openaiTranscribe(pk){
  const key=oaKey(); if(!key) return null;
  const wav=await VOICE.toWav(pk); if(!wav) return null;
  const call=async m=>{ const fd=new FormData(); fd.append("file",wav,"voice.wav"); fd.append("model",m);
    fd.append("prompt","Conversation in a Werewolf party game (Loup-Garou / Оборотни) between French and Russian friends.");
    const r=await fetch("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{"Authorization":"Bearer "+key},body:fd});
    if(!r.ok){ const e=new Error("stt "+r.status); e.status=r.status; throw e; } const j=await r.json(); return j.text||""; };
  for(const m of ["gpt-transcribe","gpt-4o-mini-transcribe","whisper-1"]){ try{ return await call(m); }catch(e){ if(e.status!==400&&e.status!==404) throw e; } }
  return null;
}

/* ---------- networking glue ---------- */
function parseHash(){
  const h=location.hash.slice(1); const m=h.match(/^g=([a-z0-9]+)\.([A-Za-z0-9_-]+)(?:\.(\d))?/);
  return m?{room:m[1],key:m[2],b:m[3]!=null?+m[3]:null}:null;
}
const IS_APP=location.protocol==="file:";
function gameHash(){ const g=APP.game; return "g="+g.room+"."+g.key+(g.b!=null?"."+g.b:""); }
function gameLink(){ return "Hurlune "+gameHash(); }
function addRecent(){ const g=APP.game; let r=lsGet("recent")||[]; r=r.filter(x=>x.room!==g.room); r.unshift({room:g.room,key:g.key,b:g.b,name:(APP.st&&APP.st.name)||g.name||"",t:Date.now()}); lsSet("recent",r.slice(0,6)); }

async function createGame(cfg){
  const g={room:rid(8),key:b64u(crypto.getRandomValues(new Uint8Array(16))),b:null,name:cfg.name};
  const hostKeys=await Crypto.genECDH();
  const host=new Host({roomId:g.room,key:g.key,broker:null,hostKeys,hostId:APP.me.pid,settings:cfg});
  APP.game=g; await startHostSession(host);
}
async function startHostSession(host){
  APP.view="game"; APP.ui.connecting=true; render();
  const room=new Room({room:host.roomId,key:host.key,broker:host.broker,me:{pid:APP.me.pid,keys:APP.me.keys},isHost:true,hostKeys:host.hostKeys});
  try{ host.broker=await room.connect(); }catch(e){ APP.ui.connecting=false; APP.ui.joinErr="relayErr"; render(); return; }
  room.on("status",s=>{ APP.ui.netStatus=s; render(); });
  APP.game={room:host.roomId,key:host.key,b:host.broker,name:host.S.name};
  history.replaceState(null,"",location.pathname+location.search+"#"+gameHash());
  APP.host=host; APP.room=room; window.HOST=host;
  host.localSink={state:onState,priv:onPriv}; host.translator=hostTranslator(); host.transcriber=oaKey()?openaiTranscribe:null;
  host.attach(room);
  host.local({t:"hello",name:APP.me.name,av:APP.me.av,lang:LANG});
  APP.ui.connecting=false; addRecent(); render();
}
async function joinGame(g){
  const saved=lsGet("host."+g.room);
  APP.game=g;
  if(saved&&saved.hostId===APP.me.pid){ await startHostSession(new Host(saved)); return; }
  APP.view="game"; APP.ui.connecting=true; APP.ui.joinErr=null; APP.st=null; APP.v={}; APP.msgs=[]; APP.msgIds=new Set(); render();
  const room=new Room({room:g.room,key:g.key,broker:g.b,me:{pid:APP.me.pid,keys:APP.me.keys},isHost:false});
  APP.room=room;
  room.on("state",st=>{ const first=!APP.st; onState(st); if(first||!APP._synced) sendHello(); });
  room.on("bcast",onPriv); room.on("priv",onPriv);
  room.on("status",s=>{ APP.ui.netStatus=s; if(s==="online") sendHello(); render(); });
  try{ await room.connect(); }catch(e){ APP.ui.connecting=false; APP.ui.joinErr="relayErr"; render(); return; }
  setTimeout(()=>{ if(!APP.st&&APP.room===room){ APP.ui.connecting=false; APP.ui.joinErr="notFound"; render(); } },9000);
}
function sendHello(){ APP._helloAt=Date.now(); send({t:"hello",name:APP.me.name,av:APP.me.av,lang:LANG}); }
function send(msg){
  if(APP.host){ APP.host.local(msg); return; }
  if(APP.room&&APP.room.hostPub) APP.room.send(msg).catch(e=>console.warn(e));
}
setInterval(()=>{ if(APP.view==="game"&&APP.room&&!APP.host){ if(!APP._synced&&APP.st&&Date.now()-(APP._helloAt||0)>4000) sendHello(); else send({t:"ping"}); } },8000);

function onState(st){
  APP.clockOff=st.now-Date.now();
  const prev=APP.st; APP.st=st; APP.ui.connecting=false;
  if(st.ph&&st.ph.seq!==APP.ui.lastPhaseSeq){
    APP.ui.lastPhaseSeq=st.ph.seq; APP.ui.sel=[]; if(APP.ui.modal&&APP.ui.modal.kind!=="settings"&&APP.ui.modal.kind!=="create") APP.ui.modal=null;
    if(prev&&prev.ph){ const wasN=prev.ph.k.startsWith("n_"), isN=st.ph.k.startsWith("n_");
      if(!wasN&&isN){ sfx("howl"); setTimeout(()=>showBanner("🌙",t("bn_night",{n:st.night}),"night"),60); }
      else if(isN) sfx("step");
      else if(wasN&&st.status==="running"){ sfx("day"); setTimeout(()=>showBanner("☀️",t("bn_day",{n:st.day}),"day"),60); }
      else if(st.ph.k==="d_cand"||st.ph.k==="d_vote"&&prev.ph.k!=="d_vote"||st.ph.k==="d_elect"||st.ph.k==="prompt") sfx("step");
      if(prev.status!=="running"&&st.status==="running") sfx("start");
      if(prev.status!=="ended"&&st.status==="ended") setTimeout(()=>sfx((st.winners||[]).includes(APP.me.pid)?"win":"lose"),900);
    }
  }
  if(prev&&prev.round!==st.round){ APP.ui.endClosed=false; }
  addRecent(); render();
}
function onPriv(o){
  if(o.t==="sync"){ APP._synced=true; APP.msgs=o.msgs; APP.msgIds=new Set(o.msgs.map(m=>m.id)); APP.v=o.v||{}; render(); scrollChat(true); return; }
  if(o.t==="v"){ APP.v=o.v||{}; render(); return; }
  if(o.t==="m"){ const m=o.m; if(APP.msgIds.has(m.id)) return; APP.msgIds.add(m.id); APP.msgs.push(m); if(APP.msgs.length>600) APP.msgs.shift();
    if(m.a&&m.x&&(m.ch==="v")&&!m.cls){ APP.ui.bubbles=APP.ui.bubbles||{}; APP.ui.bubbles[m.a]={m,until:Date.now()+5500}; if(APP.has3d) V3.speak(m.a); if(APP.view==="game") renderChars(); setTimeout(()=>{ if(APP.view==="game") renderChars(); },5700); }
    if(m.cls==="death"){ sfx("thunder"); flash(); }
    else if(m.k==="voted"||m.k==="votedMayor"||m.cls==="accuse") sfx("vote");
    else if(m.x&&APP.me.name&&m.a!==APP.me.pid&&norm(m.x).includes("@"+norm(APP.me.name))) sfx("mention");
    else if(m.cls==="seer"||m.cls==="role"||m.cls==="love") sfx("ping");
    scheduleChat(); return; }
  if(o.t==="va"){ if(o.a!==APP.me.pid){ if(!APP.set.vmute) VOICE.rx(o.a,o.s,o.d); APP.ui.vSpk={id:o.a,until:Date.now()+700}; if(APP.has3d) V3.speak(o.a); } return; }
  if(o.t==="tr"){ const m=APP.msgs.find(x=>x.id===o.id); if(m){ m.tr=o.tr; scheduleChat(); const b=APP.ui.bubbles&&APP.ui.bubbles[m.a]; if(b&&b.m.id===m.id){ b.m.tr=o.tr; if(APP.view==="game") renderChars(); } } return; }
  if(o.t==="err"){ if(o.k==="started"||o.k==="full"||o.k==="kicked"||o.k==="notInGame"){ APP.ui.joinErr=o.k; } else toast(t("e_"+o.k)); render(); }
}
function toast(s){ APP.ui.toast=s; renderToast(); clearTimeout(APP._tt); APP._tt=setTimeout(()=>{ APP.ui.toast=null; renderToast(); },3500); }
function leaveToHub(){
  if(APP.st&&(APP.st.status==="lobby"||APP.st.status==="starting")&&!APP.host) send({t:"leave"});
  if(APP.host&&APP.host._tick){ /* host keeps running only while page open; leaving stops the game */ }
  location.hash=""; location.reload();
}

function fireflies(){ let h=""; for(let i=0;i<16;i++){ h+=`<i style="left:${(Math.random()*96+2).toFixed(1)}%;top:${(Math.random()*45+45).toFixed(1)}%;animation-delay:${(Math.random()*-12).toFixed(1)}s;animation-duration:${(8+Math.random()*8).toFixed(1)}s"></i>`; } return h; }
function showBanner(ic,txt,cls){ const b=$("#pbanner"); if(!b) return; b.className="pbanner "+(cls||""); b.innerHTML=`<div class="pb-ic">${ic}</div><div class="pb-t">${esc(txt)}</div>`; void b.offsetWidth; b.classList.add("show"); clearTimeout(APP._bnT); APP._bnT=setTimeout(()=>b.classList.remove("show"),2600); }
function flash(){ const f=$("#flash"); if(!f) return; f.classList.remove("on"); void f.offsetWidth; f.classList.add("on"); }

function applyTheme(){
  const th=APP.set.theme||"village", want3d=th!=="classic"&&!QS.get("no3d");
  if(want3d){
    if(!APP.v3cv){ APP.v3cv=document.createElement("canvas"); APP.v3cv.className="v3"; APP.v3lab=document.createElement("div"); APP.v3lab.className="v3labels"; }
    const slot=$("#v3slot"); if(slot&&APP.v3cv.parentNode!==slot) slot.append(APP.v3cv,APP.v3lab);
    if(!APP.v3init&&slot){ APP.v3init=true; APP.v3ok=V3.init(APP.v3cv,APP.v3lab,th); V3.setPick(id=>clickChar(id),id=>targetable(id)); }
    else if(APP.v3ok) V3.setTheme(th);
    APP.has3d=!!APP.v3ok;
  } else APP.has3d=false;
  if(APP.v3ok) V3.pause(!APP.has3d);
  const st=$("#stage"); if(st) st.classList.toggle("has3d",!!APP.has3d);
  if(APP.v3lab){ APP.v3lab._h=""; APP.v3lab.hidden=!APP.has3d; }
  if(APP.v3cv) APP.v3cv.hidden=!APP.has3d;
  const ch=$("#chars"); if(ch&&!APP.has3d) ch.innerHTML="";
  if(APP.view==="game"&&APP.st) renderGame();
}

/* ---------- derived ---------- */
const S=()=>APP.st||{players:[],ph:{k:"lobby"}};
const V=()=>APP.v||{};
function meP(){ return pl(APP.me.pid); }
function amAlive(){ const v=V(); if(S().status!=="running") return true; return !!v.alive; }
function isNight(){ return (S().ph.k||"").startsWith("n_"); }
function phaseLabel(){
  const st=S(), k=st.ph.k;
  if(st.status==="lobby") return t("ph_wait");
  if(st.status==="starting") return t("ph_launch");
  if(st.status==="ended") return t("ph_ended");
  if(k.startsWith("n_")) return t("ph_"+k);
  if(k==="prompt") return t("ph_prompt_"+st.ph.kind);
  return t("ph_"+k,{n:st.ph.n||st.day});
}
function timeLeft(){ const st=S(); if(!st.ph||!st.ph.end) return null; return Math.max(0,Math.ceil((st.ph.end-now())/1000)); }
function chatChannel(){
  const v=V(), st=S();
  if(st.status!=="running") return "v";
  if(APP.ui.lovers&&v.chat&&v.chat.l) return "l";
  if(v.chat){ if(v.chat.w) return "w"; if(v.chat.v) return "v"; if(v.chat.d) return "d"; }
  return null;
}
function compRemaining(){
  const st=S(); const c=Object.assign({},st.comp||{});
  if(st.status==="running") for(const p of st.players) if(!p.alive&&p.role&&c[p.role]>0) c[p.role]--;
  return c;
}

/* ---------- RENDER ---------- */
let _chatT=null; function scheduleChat(){ if(_chatT) return; _chatT=requestAnimationFrame(()=>{ _chatT=null; renderChat(); }); }
function render(){
  document.documentElement.lang=LANG;
  if(APP.hero3d) APP.hero3d.pause(APP.view!=="hub");
  const app=$("#app");
  const key=APP.view;
  if(app.dataset.view!==key){ app.dataset.view=key; app.innerHTML=key==="hub"?hubSkeleton():gameSkeleton(); bindStatic(); }
  if(key==="hub") renderHub(); else renderGame();
  renderModal(); renderToast();
}
function hubSkeleton(){
  return `<div class="hub"><div class="hub-scene night">${sceneSVG()}<div class="fireflies">${fireflies()}</div></div>
  <nav class="topnav"><div class="brand">${logoSVG()}<span>Hurlune</span></div><div class="sp"></div>
   <button class="navbtn" id="gearHub">⚙︎</button>
   <div class="langsw"><button data-lang="fr">FR</button><button data-lang="ru">RU</button><button data-lang="en">EN</button></div>
   <button class="btn-primary sm" id="navPlay">▶ ${esc(t("play"))}</button></nav>
  <div class="hub-body">
    <div class="island"><div class="island-char" id="heroChar"></div><div class="island-isle">${isleSVG()}</div></div>
    <div class="hub-card">
      <div class="hub-logo">${logoSVG()}<span>Hurlune</span></div>
      <h1>${esc(t("hubTitle"))}</h1><p class="muted">${esc(t("hubSub"))}</p>
      <label>${esc(t("pseudo"))}</label>
      <div class="row"><input id="pseudo" maxlength="18" autocomplete="off" placeholder="${esc(t("pseudoPh"))}"><button class="btn-ghost" id="rndAv" title="${esc(t("newLook"))}">🎲</button></div>
      <div id="avEdit" class="av-edit"></div>
      <div id="joinBox"></div>
      <button class="btn-primary big" id="createBtn">▶ ${esc(t("createGame"))}</button>
      <div class="or"><span>${esc(t("orJoin"))}</span></div>
      <div class="row"><input id="joinCode" placeholder="${esc(t("joinPh"))}"><button class="btn-ghost" id="joinBtn">${esc(t("join"))}</button></div>
      <div id="recent"></div>
    </div>
  </div>
  <section class="roles-sec"><h2>${esc(t("rolesTitle"))}</h2><div class="roles-grid" id="rolesGrid"></div></section>
  </div>`;
}
function gameSkeleton(){
  return `<div class="game">
   <div class="stage" id="stage"><div class="scene" id="scene">${sceneSVG()}</div><div id="v3slot"></div><div class="vignette"></div><div class="fog"></div><div class="fireflies">${fireflies()}</div><div class="flash" id="flash"></div><div class="pbanner" id="pbanner"></div>
     <div class="stage-top"><button class="iconbtn" id="homeBtn" title="${esc(t("home"))}">⌂</button><span class="roomname" id="roomName"></span><button class="pillbtn" id="inviteBtn">🔗 ${esc(t("invite"))}</button><span class="net" id="net"></span></div>
     <div class="chars" id="chars"></div>
     <div class="center" id="center"></div>
   </div>
   <aside class="side">
     <div class="side-head"><div class="phase"><div class="clock"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="ring-bg"/><circle cx="18" cy="18" r="15" class="ring" id="ring"/></svg><span id="clockIc">🕐</span></div><div><div class="ph-label" id="phLabel"></div></div><div class="ph-time" id="phTime"></div></div>
       <button class="btn-rules" id="rulesBtn"></button><button class="iconbtn" id="gearBtn">⚙︎</button></div>
     <div class="panel" id="panel">
       <div class="chatlog" id="chatlog"></div>
       <div class="rules" id="rules" hidden></div>
     </div>
     <div class="vbar" id="vbar" hidden></div><form class="composer" id="composer"><button type="button" class="cbtn" id="trBtn" title="${esc(t("translate"))}">🌐</button><input id="msgIn" maxlength="400" autocomplete="off"><button type="button" class="cbtn" id="loveBtn" hidden title="${esc(t("loversChat"))}">💜</button><button class="cbtn send" id="sendBtn">➤</button></form>
   </aside>
   <div class="endov" id="endov" hidden></div>
   <div class="reveal-ov" id="revealOv" hidden></div>
  </div>`;
}
function bindStatic(){
  document.querySelectorAll("[data-lang]").forEach(b=>b.onclick=()=>setLang(b.dataset.lang));
  if(APP.view==="hub"){
    const ps=$("#pseudo"); ps.value=APP.me.name||"";
    ps.oninput=()=>{ APP.me.name=ps.value.trim().slice(0,18); saveMe(); renderHubButtons(); };
    $("#rndAv").onclick=()=>{ APP.me.av=syncLegacyAv(R4.randomAvatar()); saveMe(); renderHub(); };
    $("#createBtn").onclick=()=>{ if(!APP.me.name){ ps.focus(); toast(t("needPseudo")); return; } openCreate(); };
    $("#navPlay").onclick=$("#createBtn").onclick;
    $("#gearHub").onclick=()=>{ APP.ui.modal={kind:"settings"}; render(); };
    $("#joinBtn").onclick=()=>{
      if(!APP.me.name){ ps.focus(); toast(t("needPseudo")); return; }
      const v=$("#joinCode").value.trim(); const m=v.match(/g=([a-z0-9]+)\.([A-Za-z0-9_-]+)(?:\.(\d))?/);
      if(!m){ toast(t("badCode")); return; }
      location.hash="g="+m[1]+"."+m[2]+(m[3]?"."+m[3]:""); joinGame({room:m[1],key:m[2],b:m[3]!=null?+m[3]:null});
    };
    const grid=$("#rolesGrid");
    grid.innerHTML=ROLE_GROUPS.map(([g,rs])=>rs.map(r=>`<div class="role-tile">${roleCardHTML(r,{small:1})}<p>${esc(roleDesc(r))}</p></div>`).join("")).join("");
  } else {
    $("#homeBtn").onclick=()=>leaveToHub();
    applyTheme();
    $("#inviteBtn").onclick=()=>{ copyText(gameLink()); toast(t("codeCopied")); };
    $("#rulesBtn").onclick=()=>{ APP.ui.panel=APP.ui.panel==="chat"?"rules":"chat"; renderGame(); };
    $("#gearBtn").onclick=()=>{ APP.ui.modal={kind:"settings"}; render(); };
    $("#trBtn").onclick=()=>{ APP.set.tr=!APP.set.tr; saveSettings(); renderComposer(); renderChat(); };
    $("#loveBtn").onclick=()=>{ APP.ui.lovers=!APP.ui.lovers; renderComposer(); };
    $("#composer").onsubmit=e=>{ e.preventDefault(); const i=$("#msgIn"); const x=i.value.trim(); const ch=chatChannel(); if(!x||!ch) return; send({t:"chat",ch,x}); i.value=""; sfx("send"); };
    $("#chatlog").onclick=e=>{ const b=e.target.closest(".mn"); if(b){ const i=$("#msgIn"); i.value=(i.value+" @"+b.dataset.n+" ").replace(/^ /,""); i.focus(); } const o=e.target.closest(".showog"); if(o){ o.parentElement.classList.add("og-open"); } };
  }
}
function copyText(s){ try{ navigator.clipboard.writeText(s); }catch(e){ const ta=document.createElement("textarea"); ta.value=s; document.body.appendChild(ta); ta.select(); try{document.execCommand("copy");}catch(_){} ta.remove(); } }
function setLang(l){ LANG=l; lsSet("lang",l); const app=$("#app"); app.dataset.view=""; render(); renderModal(true); if(APP.room&&APP._synced) send({t:"hello",name:APP.me.name,av:APP.me.av,lang:LANG}); }

/* ---------- HUB ---------- */
function syncLegacyAv(av){ av.h=av.h2%6; av.o=[2,0,1,3,0][av.o2]; av.a=0; return av; }
function fullAv(av){ const o=Object.assign(R4.avNorm(av),{}); for(const k of ["h","o","a"]) if(av&&av[k]!=null) o[k]=av[k]; return syncLegacyAv(o); }
function hero3d(el,av){
  if(!QS.get("no3d")&&APP.hero3d!==false){
    if(!APP.hero3d){ APP.heroCv=document.createElement("canvas"); APP.heroCv.className="hero3d"; try{ APP.hero3d=R4.create(APP.heroCv,{preview:true,quality:APP.set.gq==="low"?"low":"med",av,mood:"dusk"}); }catch(e){ APP.hero3d=null; } if(!APP.hero3d) APP.hero3d=false; }
    if(APP.hero3d){ if(APP.heroCv.parentNode!==el){ el.innerHTML=""; el.appendChild(APP.heroCv); } el.closest(".island").classList.add("has3d"); APP.hero3d.pause(false); APP.hero3d.setAvatar(av); return; }
  }
  el.innerHTML=charSVG(av);
}
function renderHub(){
  AUD.setMood("dusk");
  document.querySelectorAll("[data-lang]").forEach(b=>b.classList.toggle("on",b.dataset.lang===LANG));
  const av=APP.me.av=fullAv(APP.me.av);
  const hero=$("#heroChar"); hero3d(hero,av);
  const ae=$("#avEdit"); const F=R4.AV_FIELDS;
  const grp=(lab,ks)=>`<div class="ae-g"><div class="ae-gt">${esc(t(lab))}</div>${ks.map(([k,l])=>`<div class="ae"><span>${esc(t(l))}</span><button data-ae="${k}" data-d="-1">‹</button><i class="ae-v">${av[k]+1}/${F[k]}</i><button data-ae="${k}" data-d="1">›</button></div>`).join("")}</div>`;
  const real=R4.CHAR_LIST&&APP.set.gq!=="low"&&typeof WebGL2RenderingContext!=="undefined";
  if(real){ const L=R4.CHAR_LIST.length; ae.innerHTML=`<div class="ae-g ae-ch"><div class="ae-gt">${esc(t("av_char"))}</div><div class="ae ae-big"><button data-ae="rc" data-d="-1">‹</button><span class="ae-name"><b>${esc(t("ch_"+R4.CHAR_LIST[av.rc%L]))}</b><i class="ae-v">${av.rc%L+1}/${L}</i></span><button data-ae="rc" data-d="1">›</button></div></div>`;
    ae.querySelectorAll("[data-ae]").forEach(b=>b.onclick=()=>{ av.rc=((av.rc|0)+(+b.dataset.d)+L)%L; saveMe(); renderHub(); }); }
  else ae.innerHTML=grp("av_skinc",[["s","av_skin"],["fs","av_face"],["ey","av_eyes"],["gl","av_glasses"],["h2","av_hair"],["hc","av_hairc"],["bd","av_beard"]])
    +grp("av_clothes",[["o2","av_outfit"],["t","av_color"],["t2","av_color2"],["p","av_pants"],["bt","av_boots"],["bl","av_belt"],["a2","av_hat"],["sc","av_scarf"]]);
  if(!real) ae.querySelectorAll("[data-ae]").forEach(b=>b.onclick=()=>{ const k=b.dataset.ae; av[k]=(av[k]+(+b.dataset.d)+F[k])%F[k]; syncLegacyAv(av); saveMe(); b.parentNode.querySelector(".ae-v").textContent=(av[k]+1)+"/"+F[k]; hero3d(hero,av); });
  const jb=$("#joinBox"); const g=parseHash();
  jb.innerHTML=g?`<div class="joinhint">${esc(t("invited"))}</div>`:"";
  if(g){ $("#createBtn").innerHTML="▶ "+esc(t("joinThis")); $("#createBtn").onclick=()=>{ if(!APP.me.name){ $("#pseudo").focus(); toast(t("needPseudo")); return; } joinGame(g); }; }
  const rec=(lsGet("recent")||[]).filter(r=>!g||r.room!==g.room);
  $("#recent").innerHTML=rec.length?`<div class="recent"><div class="muted sm">${esc(t("recent"))}</div>${rec.map(r=>`<button class="rec" data-r="${esc(r.room)}">${esc(r.name||r.room)}<span>${lsGet("host."+r.room)?"⭐":""}</span></button>`).join("")}</div>`:"";
  $("#recent").querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{ if(!APP.me.name){ toast(t("needPseudo")); return; } const r=rec.find(x=>x.room===b.dataset.r); location.hash="g="+r.room+"."+r.key+(r.b!=null?"."+r.b:""); joinGame({room:r.room,key:r.key,b:r.b}); });
  renderHubButtons();
}
function renderHubButtons(){}

/* ---------- create / edit game ---------- */
function openCreate(edit){
  const st=S();
  const base= edit ? {name:st.name,seats:st.seats,comp:clone(st.comp),mode:st.mode,speed:st.speed}
                   : {name:t("defaultGameName",{n:APP.me.name}),seats:8,comp:suggestComp(8),mode:"fun",speed:"normal",voice:true};
  APP.ui.modal={kind:"create",edit:!!edit,cfg:base}; if(edit){ APP._hold=true; send({t:"hold",on:true}); } render();
}
function releaseHold(){ if(APP._hold){ APP._hold=false; send({t:"hold",on:false}); } }
/* visage du vrai personnage (ou dessin 2D en repli) */
function faceHTML(av){
  const real=APP.set.gq!=="low"&&typeof R4!=="undefined"&&R4.CHAR_LIST&&typeof WebGL2RenderingContext!=="undefined"&&!QS.get("no3d")?R4.charSlug(R4.avNorm(av)):null;
  if(!real) return headSVG(av);
  const done=APP._faces&&APP._faces[real];
  if(done) return `<img class="face" src="${done}" alt="">`;
  APP._faces=APP._faces||{};
  R4.headshotAsync(real).then(u=>{ if(!u) return; APP._faces[real]=u; document.querySelectorAll('[data-face="'+real+'"]').forEach(el=>{ el.outerHTML=`<img class="face" src="${u}" alt="">`; }); if(APP.v3lab) APP.v3lab._h=""; });
  return `<span data-face="${real}" class="face-w">${headSVG(av)}</span>`;
}
function createModal(m){
  const c=m.cfg, tot=compTotal(c.comp), min=APP.st&&m.edit?Math.max(3,APP.st.players.length):3;
  const grp=ROLE_GROUPS.map(([g,rs])=>`<div class="cg"><div class="cg-h c-${g}">${esc(t("camp_"+g))}</div><div class="cg-grid">${rs.map(r=>{ const n=c.comp[r]||0; return `<div class="ct ${n?"on":""}" title="${esc(roleDesc(r))}"><span class="ci">${emb(r)}</span><span class="cn">${esc(roleName(r))}</span><span class="cc"><button data-cr="${r}" data-d="-1">−</button><b>${n}</b><button data-cr="${r}" data-d="1">+</button></span></div>`; }).join("")}</div></div>`).join("");
  return `<div class="mcard wide"><h2>${esc(t(m.edit?"editGame":"createGame"))}</h2>
   <div class="frm"><label>${esc(t("gameName"))}</label><input id="cName" maxlength="40" value="${esc(c.name)}"></div>
   <div class="frm row2"><div><label>${esc(t("seats"))}</label><div class="stepper"><button data-seat="-1">−</button><b>${c.seats}</b><button data-seat="1">+</button></div></div>
     <div><label>${esc(t("type"))}</label><div class="seg"><button data-mode="fun" class="${c.mode==="fun"?"on":""}">${esc(t("fun"))}</button><button data-mode="serious" class="${c.mode==="serious"?"on":""}">${esc(t("serious"))}</button></div></div>
     <div><label>${esc(t("speed"))}</label><div class="seg"><button data-speed="normal" class="${c.speed==="normal"?"on":""}">${esc(t("normal"))}</button><button data-speed="fast" class="${c.speed==="fast"?"on":""}">${esc(t("fast"))}</button></div></div>
     <div><label>${esc(t("voiceOpt"))}</label><div class="seg"><button data-voice="1" class="${c.voice!==false?"on":""}">🎙️ ${esc(t("yes"))}</button><button data-voice="0" class="${c.voice===false?"on":""}">${esc(t("no"))}</button></div></div></div>
   <div class="comp-h"><b>${esc(t("composition"))}</b><span class="${tot===c.seats?"ok":"bad"}">${tot}/${c.seats} ${esc(t("rolesWord"))}</span><button class="btn-ghost sm" id="sugg">✨ ${esc(t("suggested"))}</button></div>
   <div class="comp">${grp}</div>
   <div class="mfoot"><button class="btn-ghost" id="mCancel">${esc(t("cancel"))}</button><button class="btn-primary" id="mOk" ${tot!==c.seats||!(c.comp.werewolf||c.comp.blackWolf||c.comp.talkativeWolf||c.comp.literateWolf||c.comp.wolfRidingHood||c.comp.whiteWolf)?"disabled":""}>${esc(t(m.edit?"save":"create"))}</button></div></div>`;
  // min used in binder
}
function bindCreate(m){
  const c=m.cfg; const min=m.edit&&APP.st?Math.max(3,APP.st.players.length):3;
  const re=()=>{ c.name=$("#cName").value; renderModal(true); };
  document.querySelectorAll("[data-cr]").forEach(b=>b.onclick=()=>{ const r=b.dataset.cr; const n=Math.max(0,Math.min(ROLES[r].max,(c.comp[r]||0)+(+b.dataset.d))); if(n) c.comp[r]=n; else delete c.comp[r]; re(); });
  document.querySelectorAll("[data-seat]").forEach(b=>b.onclick=()=>{ c.seats=Math.max(min,Math.min(16,c.seats+(+b.dataset.seat))); re(); });
  document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{ c.mode=b.dataset.mode; re(); });
  document.querySelectorAll("[data-voice]").forEach(b=>b.onclick=()=>{ c.voice=b.dataset.voice==="1"; re(); });
  document.querySelectorAll("[data-speed]").forEach(b=>b.onclick=()=>{ c.speed=b.dataset.speed; re(); });
  $("#sugg").onclick=()=>{ c.comp=suggestComp(c.seats); re(); };
  $("#mCancel").onclick=()=>{ APP.ui.modal=null; releaseHold(); render(); };
  $("#mOk").onclick=async()=>{ c.name=$("#cName").value.trim()||t("defaultGameName",{n:APP.me.name});
    APP.ui.modal=null;
    if(m.edit){ send({t:"cfg",cfg:c}); releaseHold(); render(); }
    else { render(); await createGame(clone(c)); } };
}

/* ---------- GAME ---------- */
function renderGame(){
  const st=S(), v=V();
  const night = st.status==="running"&&isNight();
  const mood= st.status==="running" ? (st.ph.k==="n_wolves"?"wolves":night?"night":"day") : "dusk";
  if(APP.has3d) V3.setMood(mood); AUD.setMood(mood); $("#stage").classList.toggle("wolfturn",mood==="wolves");
  $("#stage").classList.toggle("lobbying",st.status==="lobby"||st.status==="starting"||st.status==="ended");
  const scene=$("#scene"); scene.classList.toggle("night",!(st.status==="running"&&!night)); scene.classList.toggle("day",st.status==="running"&&!night);
  $("#stage").classList.toggle("is-night",night);
  $("#roomName").textContent=st.name||"";
  const ns=APP.ui.netStatus; $("#net").innerHTML=ns==="online"?"":`<span class="netbad">⚠︎ ${esc(t("net_"+ns))}</span>`;
  $("#phLabel").textContent=phaseLabel();
  updTimer();
  const rb=$("#rulesBtn"); rb.textContent=APP.ui.panel==="chat"?"📖 "+t("rulesBtn"):"💬 "+t("chatBtn");
  $("#chatlog").hidden=APP.ui.panel!=="chat"; $("#rules").hidden=APP.ui.panel!=="rules";
  if(APP.ui.connecting||APP.ui.joinErr||!APP.st){ $("#chars").innerHTML=""; $("#center").innerHTML=connCard(); bindConn(); renderComposer(); return; }
  renderChars(); renderCenter(); renderComposer(); renderChat(); if(APP.ui.panel==="rules") renderRules(); renderEnd(); renderReveal();
}
function connCard(){
  if(APP.ui.joinErr) return `<div class="card-c"><h3>${esc(t("e_"+APP.ui.joinErr))}</h3><p class="muted">${esc(t("e_"+APP.ui.joinErr+"_d"))}</p><button class="btn-primary" id="backHub">${esc(t("home"))}</button></div>`;
  return `<div class="card-c"><div class="spinner"></div><p>${esc(t("connecting"))}</p></div>`;
}
function bindConn(){ const b=$("#backHub"); if(b) b.onclick=()=>{ location.hash=""; location.reload(); }; }
function updTimer(){
  const el=$("#phTime"); if(!el) return; const s=timeLeft(); const st=S();
  const ring=$("#ring"), ic=$("#clockIc");
  if(ic) ic.textContent= st.status==="running"?(isNight()?"🌙":st.ph.k==="prompt"?"⚰️":"☀️"):st.status==="ended"?"🏁":"⏳";
  if(s==null||st.status==="lobby"||st.status==="ended"){ el.textContent=""; if(ring) ring.style.strokeDashoffset=0; return; }
  const key=st.ph.seq;
  if(APP._tk!==key){ APP._tk=key; APP._tkTotal=Math.max(s,1); APP._tkLast=s; }
  if(s<=10&&APP._tkLast>10) sfx("warn");
  else if(s<=5&&s>0&&s!==APP._tkLast) sfx("tick");
  APP._tkLast=s;
  if(ring){ const C=2*Math.PI*15; ring.style.strokeDasharray=C; ring.style.strokeDashoffset=C*(1-Math.max(0,Math.min(1,s/APP._tkTotal))); ring.classList.toggle("hurry",s<=10); }
  const ph=document.querySelector(".phase"); if(ph) ph.classList.toggle("hurry",s<=10);
  el.textContent=Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); el.classList.toggle("hurry",s<=10);
  const bar=$("#mbar"); if(bar&&APP._mbarTotal){ bar.style.width=Math.max(0,Math.min(100,100*s/APP._mbarTotal))+"%"; }
}
setInterval(updTimer,500);

/* ---------- chat vocal ---------- */
function vcState(){ const v=V(); return v&&v.vc||null; }
function voiceSync(){
  const vc=vcState(), me=APP.me.pid; if(!vc||APP.view!=="game"){ if(VOICE.sending) VOICE.stopTx(); return; }
  const mine=vc.cur&&vc.cur.pid===me, queued=(vc.q||[]).includes(me);
  if(mine&&!VOICE.sending){
    if(VOICE.micOn&&VOICE.startTx((s,d)=>send({t:"vc",s,d}))){ sfx("ping"); }
    else if(!APP._vOpening){ APP._vOpening=true; VOICE.openMic().then(ok=>{ APP._vOpening=false; if(!ok){ send({t:"vend"}); toast(t(VOICE.micErr==="denied"?"vMicDenied":"vNoMic")); } else voiceSync(); }); }
  }
  if(!mine&&VOICE.sending) VOICE.stopTx();
  if(!mine&&!queued&&VOICE.micOn&&!APP._vOpening&&!VOICE.testing){ clearTimeout(APP._vClose); APP._vClose=setTimeout(()=>{ const v2=vcState(); if(!(v2&&((v2.q||[]).includes(APP.me.pid)||(v2.cur&&v2.cur.pid===APP.me.pid)))) VOICE.closeMic(); },4000); }
  if(mine&&APP.has3d) V3.speak(me);
}
function renderVoice(){
  const el=$("#vbar"); if(!el) return; const vc=vcState(), me=APP.me.pid;
  if(!vc||vc.off||!VOICE.canHear()){ el.hidden=true; el._h=""; return; }
  const c=vc.cur, q=vc.q||[], pos=q.indexOf(me), mine=c&&c.pid===me;
  if(!c&&!vc.ch&&!q.length){ el.hidden=true; el._h=""; return; }
  el.hidden=false;
  const left=c?Math.max(0,Math.ceil((c.until-now())/1000)):0, tot=c?Math.max(1,(c.until-c.start)/1000):1;
  const wolf=(c&&c.ch==="w")||vc.ch==="w";
  let h=`<div class="vb-top ${wolf?"wolf":""}">`;
  if(c){ const P=pl(c.pid); h+=`<div class="vb-spk ${mine?"me":""}"><span class="vb-av">${P?faceHTML(P.av):""}</span><span class="vb-t"><b>${esc(mine?t("vYou"):t("vSpeaking",{n:P?P.n:"?"}))}</b><span class="vb-bar"><i style="width:${(100*left/tot).toFixed(1)}%"></i></span></span><span class="vb-s">${left}s</span>${mine?`<span class="vb-lvl"><i style="transform:scaleY(${Math.min(1,VOICE.level()*9).toFixed(2)})"></i></span><button class="vb-btn done" id="vDone">${esc(t("vDone"))}</button>`:""}</div>`; }
  else h+=`<div class="vb-idle">🎙️ ${esc(t(wolf?"vIdleWolf":"vIdle"))}</div>`;
  if(vc.ch&&!mine){ h+= pos>=0?`<button class="vb-btn on" id="vReq">✋ ${esc(t("vCancel"))} · ${esc(t("vPos",{n:pos+1}))}</button>`:`<button class="vb-btn" id="vReq" ${VOICE.canSpeak()?"":"disabled"} title="${VOICE.canSpeak()?"":esc(t("vNoMic"))}">✋ ${esc(t("vReq"))}</button>`; }
  h+=`</div>`;
  if(q.length) h+=`<div class="vb-q"><span class="muted">${esc(t("vQueue"))}</span>${q.map((id,i)=>`<span class="vb-qi ${id===me?"me":""}">${i+1}. ${esc(pname(id))}</span>`).join("")}</div>`;
  if(el._h!==h){ el._h=h; el.innerHTML=h;
    const r=$("#vReq"); if(r) r.onclick=async()=>{ VOICE.unlock(); const on=pos<0; if(on){ const ok=await VOICE.openMic(); if(!ok){ toast(t(VOICE.micErr==="denied"?"vMicDenied":"vNoMic")); return; } } send({t:"vreq",on}); };
    const d=$("#vDone"); if(d) d.onclick=()=>{ VOICE.stopTx(); send({t:"vend"}); };
  } else if(mine){ const l=el.querySelector(".vb-lvl i"); if(l) l.style.transform=`scaleY(${Math.min(1,VOICE.level()*9).toFixed(2)})`; }
}
setInterval(()=>{ if(APP.view==="game"){ voiceSync(); renderVoice(); }
  const ml=document.querySelector("#modal .mlvl i"); if(ml) ml.style.width=(VOICE.testing?Math.min(100,VOICE.level()*700):0).toFixed(0)+"%";
  else if(VOICE.testing) VOICE.test(false);
},120);
function keepMic(){ const vc=vcState(); return !!(APP.view==="game"&&vc&&((vc.q||[]).includes(APP.me.pid)||(vc.cur&&vc.cur.pid===APP.me.pid))); }
document.addEventListener("pointerdown",()=>VOICE.unlock(),{once:true});

function layoutPositions(n){
  // rows staggered like a village square
  const rows = n<=6?[n]:n<=11?[Math.ceil(n/2),Math.floor(n/2)]:[Math.ceil(n/3),Math.ceil((n-Math.ceil(n/3))/2),n-Math.ceil(n/3)-Math.ceil((n-Math.ceil(n/3))/2)];
  const pos=[]; const R=rows.length;
  rows.forEach((cnt,ri)=>{ const y= R===1?64: R===2?(ri===0?56:76):(ri===0?50:ri===1?66:82);
    for(let i=0;i<cnt;i++){ const x= cnt===1?50: 10+ (80*(i+ (ri%2?0.5:0)))/(cnt-(ri%2?0:1)||1); pos.push({x:Math.min(92,x),y,z:ri}); } });
  return pos;
}
function targetable(id){
  const st=S(), v=V(), me=APP.me.pid, p=pl(id); if(!p) return false;
  const pr=v.prompt;
  if(pr&&(!pr.acted||pr.k==="wolves")&&pr.k!=="cand"&&pr.k!=="dictAsk"&&pr.k!=="witch") return promptValid(pr,id);
  if(pr&&pr.k==="witch"&&APP.ui.poisonMode) return p.alive&&id!==me;
  if(st.status!=="running"||!v.alive) return false;
  if(st.ph.k==="d_vote") return p.alive&&id!==me;
  if(st.ph.k==="d_elect") return p.alive&&(st.cands||[]).includes(id);
  return false;
}
function promptValid(pr,id){
  const p=pl(id), me=APP.me.pid, v=V(); if(!p) return false;
  if(pr.k==="grave") return id!==me;
  if(!p.alive) return false;
  if(pr.k==="tie") return pr.opts.includes(id);
  if(pr.k==="wolves") return !(v.wolves||[]).includes(id);
  if(pr.k==="guard") return id!==pr.not;
  if(pr.k==="pyro") return id!==me&&!(pr.barrels||[]).includes(id);
  if(pr.self) return true;
  return id!==me;
}
function renderChars(){
  if(APP.has3d) return renderChars3D();
  const st=S(), v=V(), me=APP.me.pid;
  const ps=st.players; const pos=layoutPositions(ps.length);
  const votes=st.votes||{}, cnt={}; for(const a in votes){ cnt[votes[a]]=(cnt[votes[a]]||[]); cnt[votes[a]].push(a); }
  const wolves=v.wolves||[], seen={}; (v.seen||[]).forEach(s=>seen[s.t]=s);
  const sel=APP.ui.sel, myVote=votes[me];
  const wolfVotes=v.wolfVotes||{}, wcnt={}; for(const a in wolfVotes) wcnt[wolfVotes[a]]=(wcnt[wolfVotes[a]]||0)+1;
  const sleeping = st.status==="running"&&isNight();
  $("#chars").innerHTML=ps.map((p,i)=>{
    const q=pos[i]; const dead=st.status!=="lobby"&&st.status!=="starting"&&!p.alive;
    const badges=[];
    if(wolves.includes(p.id)||(st.status==="ended"&&p.role&&ROLES[p.role].camp==="wolf")) badges.push(`<span class="bd wolf" title="${esc(t("wolf"))}">🐾</span>`);
    if(st.mayor===p.id&&p.alive) badges.push(`<span class="bd mayor" title="${esc(t("mayor"))}">★</span>`);
    if(v.lover===p.id||(p.id===me&&v.lover)||(v.couple||[]).includes(p.id)||(st.lovers||[]).includes(p.id)) badges.push(`<span class="bd love">♥</span>`);
    if((v.conta||[]).includes(p.id)) badges.push(`<span class="bd conta">✚</span>`);
    if((v.barrels||[]).includes(p.id)) badges.push(`<span class="bd fire">🛢️</span>`);
    let roleTag="";
    if(p.role) roleTag=`${ROLES[p.role].icon} ${roleName(p.role)}`;
    else if(p.id===me&&v.role) roleTag=`${ROLES[v.role].icon} ${roleName(v.role)}`;
    else if(seen[p.id]) roleTag=seen[p.id].r?`🔮 ${roleName(seen[p.id].r)}`:`✨ ${t(seen[p.id].aura==="dark"?"auraDarkS":"auraLightS")}`;
    else if(v.lover===p.id&&v.loverRole) roleTag=`💘 ${roleName(v.loverRole)}`;
    const voters=cnt[p.id]||[];
    const clickable=targetable(p.id);
    const isSel=sel.includes(p.id)||(myVote===p.id)||(v.prompt&&v.prompt.k==="wolves"&&wolfVotes[me]===p.id);
    const isCand=(st.cands||[]).includes(p.id)&&(st.ph.k==="d_cand"||st.ph.k==="d_elect");
    return `<div class="ch ${dead?"dead":""} ${p.inact?"inact":""} ${clickable?"clk":""} ${isSel?"sel":""} ${p.id===me?"me":""}" style="left:${q.x}%;top:${q.y}%;z-index:${10+q.z}" data-id="${esc(p.id)}">
      <div class="tag"><span class="nm">${esc(p.n)}</span>${badges.join("")}</div>
      ${roleTag?`<div class="rtag">${esc(roleTag)}</div>`:""}
      ${isCand?`<div class="cand">🎗️ ${esc(t("candidate"))}</div>`:""}
      ${bubbleFor(p.id)}
      <div class="fig ${dead?"":"bob"}" style="animation-delay:${(i*0.37)%2}s">${dead?tombSVG():charSVG(p.av,{sleep:sleeping&&p.id!==me})}</div><div class="isle">${isleSVG()}</div>
      ${voters.length?`<div class="votes" data-tip="${esc(t("votedBy")+" "+voters.map(pname).join(", "))}"><b>${voters.length}</b>${voters.slice(0,6).map(a=>`<i>${faceHTML((pl(a)||{}).av)}</i>`).join("")}</div>`:""}
      ${wcnt[p.id]?`<div class="votes wolfv"><b>🐺 ${wcnt[p.id]}</b></div>`:""}
    </div>`;
  }).join("");
  document.querySelectorAll(".ch.clk").forEach(el=>el.onclick=()=>clickChar(el.dataset.id));
  document.querySelectorAll(".ch .nm").forEach(el=>el.onclick=e=>{ e.stopPropagation(); const i=$("#msgIn"); if(i){ i.value=(i.value+" @"+el.textContent+" ").replace(/^ /,""); i.focus(); } });
}
function renderChars3D(){
  const st=S(), v=V(), me=APP.me.pid, ps=st.players;
  const votes=(v.prompt&&v.prompt.k==="wolves"&&v.wolfVotes)?v.wolfVotes:(st.votes||{}); const cnt={}; for(const a in votes){ (cnt[votes[a]]=cnt[votes[a]]||[]).push(a); }
  const wolves=v.wolves||[], seen={}; (v.seen||[]).forEach(s=>seen[s.t]=s);
  const myVote=(st.votes||{})[me], wv=(v.wolfVotes||{})[me];
  const sleeping=st.status==="running"&&isNight();
  V3.setPlayers(ps.map(p=>({id:p.id,av:p.av,alive:st.status==="lobby"||st.status==="starting"?true:p.alive,inact:p.inact,sleep:sleeping,
     click:targetable(p.id),sel:APP.ui.sel.includes(p.id)||myVote===p.id||(v.prompt&&v.prompt.k==="wolves"&&wv===p.id),wolf:!!(v.prompt&&v.prompt.k==="wolves")})),me);
  V3.setVotes(votes);
  const lab=APP.v3lab; if(!lab) return;
  const html=ps.map(p=>{
    const dead=st.status!=="lobby"&&st.status!=="starting"&&!p.alive;
    const badges=[];
    if(wolves.includes(p.id)||(st.status==="ended"&&p.role&&ROLES[p.role].camp==="wolf")) badges.push(`<span class="bd wolf">🐾</span>`);
    if(st.mayor===p.id&&p.alive) badges.push(`<span class="bd mayor">★</span>`);
    if(v.lover===p.id||(p.id===me&&v.lover)||(v.couple||[]).includes(p.id)||(st.lovers||[]).includes(p.id)) badges.push(`<span class="bd love">♥</span>`);
    if((v.conta||[]).includes(p.id)) badges.push(`<span class="bd conta">✚</span>`);
    if((v.barrels||[]).includes(p.id)) badges.push(`<span class="bd fire">🛢️</span>`);
    let roleTag="";
    if(p.role) roleTag=roleName(p.role); else if(p.id===me&&v.role) roleTag=roleName(v.role);
    else if(seen[p.id]) roleTag=seen[p.id].r?"🔮 "+roleName(seen[p.id].r):"✨ "+t(seen[p.id].aura==="dark"?"auraDarkS":"auraLightS");
    else if(v.lover===p.id&&v.loverRole) roleTag="💘 "+roleName(v.loverRole);
    const er=p.role||(p.id===me?v.role:null)||(seen[p.id]&&seen[p.id].r)||null;
    const voters=cnt[p.id]||[];
    const isCand=(st.cands||[]).includes(p.id)&&(st.ph.k==="d_cand"||st.ph.k==="d_elect");
    return `<div class="lb ${dead?"dead":""} ${p.id===me?"me":""} ${p.inact?"inact":""}" data-id="${esc(p.id)}">
      ${bubbleFor(p.id)}
      ${isCand?`<div class="cand">🎗️ ${esc(t("candidate"))}</div>`:""}
      ${roleTag?`<div class="rtag">${er?`<span class="re">${emb(er)}</span>`:""}${esc(roleTag)}</div>`:""}
      <div class="tag"><span class="nm">${esc(p.n)}</span>${badges.join("")}</div>
      ${voters.length?`<div class="votes3 ${v.prompt&&v.prompt.k==="wolves"?"wolfv":""}" data-tip="${esc(t("votedBy")+" "+voters.map(pname).join(", "))}"><b>${voters.length}</b>${voters.slice(0,6).map(a=>`<i>${faceHTML((pl(a)||{}).av)}</i>`).join("")}${voters.length>6?`<em>+${voters.length-6}</em>`:""}</div>`:""}
    </div>`; }).join("");
  if(lab._h!==html){ lab._h=html; lab.innerHTML=html; lab.querySelectorAll(".nm").forEach(el=>el.onclick=e=>{ e.stopPropagation(); const i=$("#msgIn"); if(i){ i.value=(i.value+" @"+el.textContent+" ").replace(/^ /,""); i.focus(); } }); }
}
function bubbleFor(id){
  const b=APP.ui.bubbles&&APP.ui.bubbles[id]; if(!b||b.until<Date.now()) return "";
  let x=b.m.x; if(needTr(b.m)){ const r=trGet(b.m); if(r&&r.x) x=r.x; else if(r===undefined) trRequest(b.m); }
  if(x.length>70) x=x.slice(0,68)+"…";
  return `<div class="bubble">${esc(x)}</div>`;
}
function clickChar(id){
  const st=S(), v=V(), pr=v.prompt;
  if(pr&&pr.k==="witch"&&APP.ui.poisonMode){ APP.ui.witch={poison:id}; APP.ui.poisonMode=false; renderGame(); return; }
  if(pr&&(!pr.acted||pr.k==="wolves")&&pr.k!=="cand"&&pr.k!=="dictAsk"&&pr.k!=="witch"){ promptPick(pr,id); return; }
  if(st.ph.k==="d_vote"){
    const myVote=(st.votes||{})[APP.me.pid];
    if(myVote===id){ send({t:"act",seq:st.ph.seq,d:{t:null}}); return; }
    const others=Object.entries(st.votes||{}).filter(([a,b])=>b===id&&a!==APP.me.pid).length;
    if(!others){ APP.ui.modal={kind:"why",t:id}; render(); setTimeout(()=>{ const i=$("#whyIn"); if(i) i.focus(); },30); return; }
    send({t:"act",seq:st.ph.seq,d:{t:id}}); return;
  }
  if(st.ph.k==="d_elect"){ const myVote=(st.votes||{})[APP.me.pid]; send({t:"act",seq:st.ph.seq,d:{t:myVote===id?null:id}}); }
}
function promptPick(pr,id){
  const n=pr.n||1; let sel=APP.ui.sel;
  if(sel.includes(id)) sel=sel.filter(x=>x!==id); else sel=[...sel,id].slice(-n);
  APP.ui.sel=sel;
  if(pr.k==="wolves"){ send({t:"act",seq:pr.seq,d:{t:id,infect:!!APP.ui.infect}}); APP.ui.sel=[id]; renderGame(); return; }
  renderGame();
}
function confirmPrompt(){
  const pr=V().prompt; if(!pr) return; const sel=APP.ui.sel;
  let d=null;
  if(pr.k==="cupid"||pr.k==="rat"){ if(!sel.length||(pr.k==="cupid"&&sel.length!==2)) return; d={ts:sel}; }
  else if(sel.length) d={t:sel[0]};
  if(!d) return;
  send({t:"act",seq:pr.seq,d}); APP.ui.sel=[];
}
function promptTitle(pr){ return t("pt_"+pr.k); }
function promptText(pr){
  const v=V();
  switch(pr.k){
    case "seer": return t("pd_seer_"+v.role);
    case "witch": return pr.victim?t("pd_witchVictim",{n:esc(pname(pr.victim))}):t("pd_witchNone");
    default: return t("pd_"+pr.k);
  }
}
function renderCenter(){
  const st=S(), v=V(), el=$("#center"), pr=v.prompt, me=APP.me.pid;
  let h="";
  if(st.status==="lobby"||st.status==="starting"){
    const n=st.players.length;
    h=`<div class="card-c lobby"><div class="lb-top">${logoSVG()}<div><h3>${esc(st.name||"")}</h3><div class="muted">${esc(t("waitingPlayers",{n,m:st.seats}))} · ${esc(t(st.mode==="serious"?"serious":"fun"))} · ${esc(t(st.speed==="fast"?"fast":"normal"))}</div></div></div>
      <div class="invite"><input readonly value="${esc(gameLink())}" id="invIn"><button class="btn-primary sm" id="copyInv">${esc(t("copy"))}</button></div>
      <div class="compline ${APP.host?"editable":""}" ${APP.host?`id="compEdit" title="${esc(t("editGame"))}"`:""}>${Object.entries(st.comp||{}).filter(([r,c])=>c).map(([r,c])=>`<span class="cpill c-${ROLES[r].camp}" title="${esc(roleDesc(r))}"><span class="re">${emb(r)}</span>${esc(roleName(r))}${c>1?" ×"+c:""}</span>`).join("")}</div>
      ${st.status==="starting"?`<div class="launch">${esc(t("launchingSoon"))}</div>`:""}
      ${APP.host?`<div class="row c"><button class="btn-primary sm" id="editG">✏️ ${esc(t("editGame"))}</button>${n>=3&&n<st.seats?`<button class="btn-ghost sm" id="forceG">▶ ${esc(t("startNow",{n}))}</button>`:""}</div><p class="muted sm">${esc(t("hostNote"))}</p>`:""}
    </div>`;
  } else if(pr&&(!pr.acted||pr.k==="wolves")&&pr.k!=="cand"){
    const total=(SPEEDS[st.speed]||SPEEDS.normal); APP._mbarTotal=Math.max(1,Math.round(((st.ph.end||0)-now())/1000));
    const er=pr.k==="succ"||pr.k==="tie"?"dictator":pr.k==="grave"?"gravedigger":pr.k==="hunter"?"hunter":pr.k==="wolves"?(v.role==="whiteWolf"||v.camp!=="wolf"?"werewolf":v.role):v.role;
    h=`<div class="card-c act"><div class="act-ic">${emb(er)}</div><h3>${esc(promptTitle(pr))}</h3><p>${promptText(pr)}</p>`;
    if(pr.k==="dictAsk"){ h+=`<div class="row c"><button class="btn-ghost" data-dict="0">${esc(t("no"))}</button><button class="btn-primary" data-dict="1">🎖️ ${esc(t("dictYes"))}</button></div>`; }
    else if(pr.k==="witch"){
      const w=APP.ui.witch||{};
      h+=`<div class="potions"><div class="pot">💚 ${esc(t("healLeft",{n:pr.heal}))}</div><div class="pot">☠️ ${esc(t("poisonLeft",{n:pr.poison}))}</div></div><div class="row c">`;
      if(pr.heal>0&&pr.victim) h+=`<button class="btn-ghost ${w.heal?"on":""}" id="wHeal">💚 ${esc(t("healBtn",{n:pname(pr.victim)}))}</button>`;
      if(pr.poison>0) h+=`<button class="btn-ghost ${w.poison||APP.ui.poisonMode?"on":""}" id="wPoison">☠️ ${esc(w.poison?t("poisonOn",{n:pname(w.poison)}):APP.ui.poisonMode?t("pickTarget"):t("poisonBtn"))}</button>`;
      h+=`</div><div class="row c"><button class="btn-ghost" id="wSkip">${esc(t("doNothing"))}</button><button class="btn-primary" id="wOk" ${w.heal||w.poison?"":"disabled"}>${esc(t("confirm"))}</button></div>`;
    } else {
      const opts=st.players.filter(p=>promptValid(pr,p.id));
      if(pr.k==="pyro") h+=`<div class="row c"><button class="btn-ghost" id="ignite">🔥 ${esc(t("ignite",{n:(pr.barrels||[]).length}))}</button></div>`;
      if(pr.k==="wolves"&&pr.infect) h+=`<label class="chk"><input type="checkbox" id="infChk" ${APP.ui.infect?"checked":""}> 🦠 ${esc(t("infectOpt"))}</label>`;
      h+=`<div class="chips">${opts.map(p=>`<button class="chip ${APP.ui.sel.includes(p.id)||(pr.k==="wolves"&&(v.wolfVotes||{})[me]===p.id)?"on":""}" data-pk="${esc(p.id)}">${faceHTML(p.av)}<span>${esc(p.n)}${p.id===me?" ("+esc(t("you"))+")":""}</span>${pr.k==="wolves"&&countW(p.id)?`<em>🐺${countW(p.id)}</em>`:""}</button>`).join("")}</div>`;
      if(pr.k==="hunter") h+=`<div class="row c"><button class="btn-ghost" id="hNone">${esc(t("noOne"))}</button></div>`;
      if(pr.k!=="wolves") h+=`<div class="row c"><button class="btn-primary" id="pOk" ${APP.ui.sel.length===(pr.k==="cupid"?2:pr.k==="rat"?APP.ui.sel.length||99:1)&&APP.ui.sel.length?"":"disabled"}>${esc(t("confirm"))}</button></div>`;
    }
    h+=`<div class="mbar"><i id="mbar"></i></div></div>`;
  } else if(pr&&pr.k==="cand"){
    h=`<div class="card-c slim"><p>${esc(t("candInfo"))}</p><button class="btn-primary" id="candBtn">🎗️ ${esc(t("candBtn"))}</button></div>`;
  } else if(pr&&pr.acted&&pr.k!=="wolves"){
    h=`<div class="card-c slim done">✔ ${esc(t("actionDone"))}</div>`;
  } else if(st.status==="running"){
    const info=centerInfo(); if(info) h=`<div class="card-c slim">${info}</div>`;
  }
  el.innerHTML=h;
  const b=(id,fn)=>{ const x=$(id); if(x) x.onclick=fn; };
  b("#copyInv",()=>{ copyText(gameLink()); toast(t("codeCopied")); });
  b("#editG",()=>openCreate(true)); b("#compEdit",()=>openCreate(true));
  b("#forceG",()=>send({t:"forceStart"}));
  el.querySelectorAll("[data-pk]").forEach(x=>x.onclick=()=>promptPick(pr,x.dataset.pk));
  b("#pOk",confirmPrompt);
  b("#hNone",()=>send({t:"act",seq:pr.seq,d:{none:true}}));
  b("#ignite",()=>send({t:"act",seq:pr.seq,d:{ignite:true}}));
  el.querySelectorAll("[data-dict]").forEach(x=>x.onclick=()=>send({t:"act",seq:pr.seq,d:{yes:x.dataset.dict==="1"}}));
  const inf=$("#infChk"); if(inf) inf.onchange=()=>{ APP.ui.infect=inf.checked; const mv=(V().wolfVotes||{})[me]; if(mv) send({t:"act",seq:pr.seq,d:{t:mv,infect:APP.ui.infect}}); };
  b("#wHeal",()=>{ const w=APP.ui.witch||{}; APP.ui.witch=w.heal?{}:{heal:true}; APP.ui.poisonMode=false; renderGame(); });
  b("#wPoison",()=>{ const w=APP.ui.witch||{}; if(w.poison){ APP.ui.witch={}; APP.ui.poisonMode=false; } else { APP.ui.witch={}; APP.ui.poisonMode=!APP.ui.poisonMode; } renderGame(); });
  b("#wSkip",()=>{ send({t:"act",seq:pr.seq,d:{skip:true}}); APP.ui.witch={}; APP.ui.poisonMode=false; });
  b("#wOk",()=>{ const w=APP.ui.witch||{}; send({t:"act",seq:pr.seq,d:w.heal?{heal:true}:{poison:w.poison}}); APP.ui.witch={}; APP.ui.poisonMode=false; });
  b("#candBtn",()=>{ APP.ui.modal={kind:"cand"}; render(); setTimeout(()=>{ const i=$("#whyIn"); if(i) i.focus(); },30); });
}
function countW(id){ const w=V().wolfVotes||{}; return Object.values(w).filter(x=>x===id).length; }
function centerInfo(){
  const st=S(), v=V(), k=st.ph.k;
  if(!v.alive&&k!=="prompt") return `💀 ${esc(t("youDead"))}`;
  if(k.startsWith("n_")) return `🌙 ${esc(t("sleeping"))}`;
  if(k==="d_vote") return `🗳️ ${esc(t("voteHelp"))}`;
  if(k==="d_elect") return `🗳️ ${esc(t("electHelp"))}`;
  if(k==="d_cand") return `🎗️ ${esc(t("candWait"))}`;
  if(k==="prompt") return `⏳ ${esc(t("waitPrompt",{n:pname(st.ph.who)}))}`;
  if(k==="d_dict") return `🎖️ ${esc(t("dictWait",{n:pname(st.ph.who)}))}`;
  if(k==="d_tie") return `⚖️ ${esc(t("tieWait"))}`;
  return "";
}
function renderComposer(){
  const i=$("#msgIn"); if(!i) return; const ch=chatChannel(), v=V(), st=S();
  const tb=$("#trBtn"); tb.classList.toggle("on",!!APP.set.tr);
  const lb=$("#loveBtn"); lb.hidden=!(v.chat&&v.chat.l); lb.classList.toggle("on",!!APP.ui.lovers);
  i.disabled=!ch; $("#sendBtn").disabled=!ch;
  let ph=t("typeMsg");
  if(!ch){ ph= st.status==="running"&&!v.alive?t("deadNoTalk"):isNight()?t("nightQuiet"):t("cantTalk"); }
  else if(ch==="w") ph=t("typeWolf"); else if(ch==="d") ph=v.alive?t("typeNecro"):t("typeDead"); else if(ch==="l") ph=t("typeLove");
  i.placeholder=ph; $("#composer").className="composer ch-"+(ch||"x");
}
let _lastChatLen=0;
function msgVisible(m){
  const st=S(), v=V();
  if(m.ch==="w"&&st.status==="running"&&v.chat&&!v.chat.seeW) return false;
  return true;
}
function renderChat(){
  const log=$("#chatlog"); if(!log||APP.view!=="game") return;
  const atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<80;
  const me=APP.me.pid, myn=norm(APP.me.name);
  let h=""; let lastA=null;
  for(const m of APP.msgs){
    if(!msgVisible(m)) continue;
    if(m.k&&!m.x&&(m.ch==="s"||m.ch==="ps")){
      lastA=null;
      const cls=m.cls||"info";
      h+=`<div class="sm-${cls} sysm ${m.ch==="ps"?"privm":""}">${fmt(m.k,m.p)}</div>`; continue;
    }
    let body=esc(m.x||"").replace(/@([^\s@]{1,18})/g,(a,n)=>`<b class="mn" data-n="${esc(n)}">@${n}</b>`);
    let trH="";
    if(m.x&&needTr(m)){ const r=trGet(m); if(!r&&!(S().oa&&Date.now()+APP.clockOff-(m.t||0)<15000)) trRequest(m);
      if(r&&r.x){ body=`<div class="trx">${esc(r.x)}</div><div class="ogx">${body}</div><button class="showog">${esc(t("original"))}</button>`; }
      else if(!r){ trH=`<div class="trwait">…</div>`; } }
    const mention=m.x&&myn&&m.a!==me&&norm(m.x).includes("@"+myn);
    const cls=["msg","ch-"+m.ch,m.cls?"mc-"+m.cls:"",m.a===me?"mine":"",mention?"mention":""].join(" ");
    const P=m.a&&!String(m.a).startsWith("anon:")?pl(m.a):null;
    const name=m.necro?"💀 "+t("r_necromancer"):(m.anon?"🐺 "+m.n:(P?P.n:m.n));
    const same=lastA===(m.a||m.n)+m.ch&&!m.cls;
    lastA=(m.a||m.n)+m.ch;
    const pre = m.cls==="accuse"?`<div class="acc">🗳️ ${fmt("accuse",m.p)}</div>`: m.cls==="pres"?`<div class="acc pres">🎗️ ${esc(t("m_presents"))}</div>`:"";
    h+=`<div class="${cls} ${same?"cont":""}">${same?"":`<div class="mav">${P?faceHTML(P.av):m.anon?"🐺":m.necro?"💀":""}</div>`}<div class="mbody">${same?"":`<div class="mname"><b class="mn" data-n="${esc(P?P.n:m.n)}">${esc(name)}</b>${m.vo?` <span class="vo" title="${esc(t("vTranscript"))}">🎤</span>`:""}${m.ch==="w"?` <span class="chtag w">${esc(t("wolves"))}</span>`:m.ch==="d"?` <span class="chtag d">${esc(t("graveyard"))}</span>`:m.ch==="l"?` <span class="chtag l">${esc(t("lovers"))}</span>`:""}</div>`}${pre}<div class="mtext">${body}</div>${trH}</div></div>`;
  }
  log.innerHTML=h;
  if(atBottom||APP.msgs.length!==_lastChatLen&&APP.msgs.length&&APP.msgs[APP.msgs.length-1].a===me) log.scrollTop=log.scrollHeight;
  _lastChatLen=APP.msgs.length;
}
function scrollChat(){ const log=$("#chatlog"); if(log) log.scrollTop=log.scrollHeight; }
function renderRules(){
  const el=$("#rules"), v=V(), st=S();
  let h="";
  if(v.role){
    const r=v.role;
    h+=`<div class="myrole"><div class="mr-card">${roleCardHTML(r,{small:1,camp:v.camp==="wolf"?"wolf":ROLES[r].camp})}</div><div><div class="muted sm">${esc(t("yourRole"))}</div><h3>${esc(roleName(r))}</h3><p>${esc(roleDesc(r))}</p><div class="goal">🎯 ${esc(t("goal_"+(v.camp==="wolf"?"wolf":r==="whiteWolf"?"white":r==="sickRat"?"rat":r==="mercenary"&&v.camp==="solo"?"merc":"village")))}</div></div></div>`;
    const info=[];
    if(v.infected) info.push("🦠 "+t("i_infected"));
    if(v.orig&&v.orig!==r) info.push("📜 "+t("i_orig",{r:roleName(v.orig)}));
    if(v.wolves&&v.wolves.length>1) info.push("🐾 "+t("i_pack",{n:v.wolves.filter(x=>x!==APP.me.pid).map(pname).join(", ")}));
    if(v.lover) info.push("💜 "+t("i_lover",{n:pname(v.lover),r:roleName(v.loverRole)}));
    if(v.couple) info.push("💘 "+t("i_couple",{a:pname(v.couple[0]),b:pname(v.couple[1])}));
    (v.seen||[]).forEach(s=>info.push(s.r?"🔮 "+t("i_seen",{n:pname(s.t),r:roleName(s.r)}):"✨ "+t("i_aura",{n:pname(s.t),a:t(s.aura==="dark"?"auraDarkS":"auraLightS")})));
    if(v.pot) info.push("🧪 "+t("i_pot",{h:v.pot.heal,p:v.pot.poison}));
    if(v.guardLast) info.push("🛡️ "+t("i_guard",{n:pname(v.guardLast)}));
    if(v.barrels&&v.barrels.length) info.push("🛢️ "+t("i_barrels",{n:v.barrels.map(pname).join(", ")}));
    if(v.testator) info.push("📜 "+t("i_testator",{n:pname(v.testator)}));
    if(v.merc) info.push("🗡️ "+t("i_merc",{n:pname(v.merc)}));
    if(v.word) info.push("🗣️ "+t("i_word",{w:v.word})+(v.saidWord?" ✔":""));
    if(v.letter) info.push("✒️ "+t("i_letter",{l:v.letter.toUpperCase()})+(v.usedLetter?" ✖":""));
    if(v.conta) info.push("🐀 "+t("i_conta",{n:v.conta.map(pname).join(", ")}));
    if(info.length) h+=`<div class="infos">${info.map(x=>`<div>${esc(x)}</div>`).join("")}</div>`;
  } else h+=`<p class="muted">${esc(t("noRoleYet"))}</p>`;
  const rem=compRemaining();
  h+=`<h4>${esc(t(st.status==="running"?"remaining":"composition"))}</h4><div class="remgrid">${Object.entries(rem).filter(([r,c])=>c>0).map(([r,c])=>`<div class="rem c-${ROLES[r].camp}" title="${esc(roleDesc(r))}"><span class="re">${emb(r)}</span><b>${esc(roleName(r))}</b><em>×${c}</em></div>`).join("")}</div>`;
  const deadP=st.players.filter(p=>!p.alive&&p.role);
  if(deadP.length) h+=`<h4>${esc(t("deathJournal"))}</h4><div class="journal">${deadP.map(p=>`<div>💀 <b>${esc(p.n)}</b> — ${ROLES[p.role].icon} ${esc(roleName(p.role))}</div>`).join("")}</div>`;
  h+=`<h4>${esc(t("howTo"))}</h4><p class="muted sm">${esc(t("howToText"))}</p>`;
  el.innerHTML=h;
}
function renderReveal(){
  const el=$("#revealOv"), st=S(), v=V(); if(!el) return;
  if(st.status!=="running"||!v.role){ el.hidden=true; return; }
  const key=st.room+"|"+st.round+"|"+v.role+"|"+v.camp;
  const seen=lsGet("seenRev")||[];
  if(seen.includes(key)){ el.hidden=true; return; }
  if(el.dataset.key===key&&!el.hidden) return;
  el.dataset.key=key; el.hidden=false;
  const changed=seen.some(k=>k.startsWith(st.room+"|"+st.round+"|"));
  el.innerHTML=`<div class="rv-box"><div class="rv-title">${esc(t(changed?"rv_changed":"rv_title"))}</div>
    <div class="flip" id="flipCard"><div class="flip-in"><div class="face fback">${cardBackHTML()}</div><div class="face ffront">${roleCardHTML(v.role,{camp:v.camp==="wolf"?"wolf":ROLES[v.role].camp})}</div></div></div>
    <div class="rv-hint" id="rvHint">${esc(t("rv_click"))}</div>
    <div class="rv-extra" id="rvExtra" hidden>${v.infected?`<p>🦠 ${esc(t("i_infected"))}</p>`:""}${v.wolves&&v.wolves.length>1?`<p>🐾 ${esc(t("i_pack",{n:v.wolves.filter(x=>x!==APP.me.pid).map(pname).join(", ")}))}</p>`:""}<div class="goal">🎯 ${esc(t("goal_"+(v.camp==="wolf"?"wolf":v.role==="whiteWolf"?"white":v.role==="sickRat"?"rat":v.role==="mercenary"&&v.camp==="solo"?"merc":"village")))}</div>
    <button class="btn-primary" id="rvOk">${esc(t("rv_ok"))}</button></div></div>`;
  const fc=$("#flipCard");
  fc.onclick=()=>{ if(fc.classList.contains("flipped")) return; fc.classList.add("flipped"); sfx("flip"); $("#rvHint").hidden=true; setTimeout(()=>{ const x=$("#rvExtra"); if(x) x.hidden=false; },650); };
  $("#rvOk").onclick=()=>{ const s=lsGet("seenRev")||[]; s.push(key); lsSet("seenRev",s.slice(-40)); el.hidden=true; };
}
function winPortrait(av,w){
  if(APP.has3d&&V3.r4){ const mood=w==="wolf"?"wolves":w==="village"?"day":"dusk", big=APP.set.gq!=="low";
    const real=APP.set.gq!=="low"&&R4.charSlug(R4.avNorm(av));
    if(!real){ const u=R4.portrait(av,mood,big); if(u) return `<img class="w3d" src="${u}" alt="">`; }
    else { const k=JSON.stringify([av,mood,big]); const u=R4._pc&&R4._pc.get(k)&&R4.CHARS[real]&&R4._pcReal&&R4._pcReal.has(k)?R4._pc.get(k):null; if(u) return `<img class="w3d" src="${u}" alt="">`;
      const id="wp"+(APP._wpN=(APP._wpN||0)+1); R4.portraitAsync(av,mood,big).then(x=>{ if(!x) return; (R4._pcReal=R4._pcReal||new Set()).add(k); const el=document.getElementById(id); if(el) el.src=x; });
      return `<img class="w3d" id="${id}" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="">`; } }
  return charSVG(av);
}
function renderEnd(){
  const el=$("#endov"), st=S();
  if(st.status!=="ended"||APP.ui.endClosed){ el.hidden=true; return; }
  el.hidden=false;
  const win=st.winners||[];
  const mine=win.includes(APP.me.pid);
  let conf=""; if(mine){ for(let i=0;i<60;i++) conf+=`<i style="left:${Math.random()*100}%;background:hsl(${Math.random()*360} 85% 65%);animation-delay:${(Math.random()*2.5).toFixed(2)}s;animation-duration:${(2.5+Math.random()*2).toFixed(2)}s"></i>`; }
  el.innerHTML=`<div class="confetti">${conf}</div><div class="endcard w-${esc(st.winner)}"><div class="end-res ${mine?"won":"lost"}">${esc(t(mine?"youWon":"youLost"))}</div><div class="endico">${{village:"🏡",wolf:"🐺",lovers:"💘",white:"🤍",rat:"🐀",merc:"🗡️",draw:"⚖️"}[st.winner]||"🏁"}</div><h2>${esc(t("win_"+st.winner))}</h2>
   <div class="winners">${win.map(id=>{ const p=pl(id); return p?`<div class="wch">${winPortrait(p.av,st.winner)}<b title="${esc(p.n)}">${esc(p.n)}</b></div>`:""; }).join("")}</div>
   <div class="reveal">${st.players.map(p=>`<div class="${win.includes(p.id)?"w":""} ${p.alive?"":"dead"}"><span class="re">${p.role?emb(p.role):""}</span><div class="rvt"><b title="${esc(p.n)}">${p.alive?"":"💀 "}${esc(p.n)}</b><span>${p.role?esc(roleName(p.role)):""}${p.inf?" 🦠":""}</span></div></div>`).join("")}</div>
   <div class="row c">${APP.host?`<button class="btn-primary" id="againBtn">↻ ${esc(t("playAgain"))}</button>`:`<span class="muted">${esc(t("waitAgain"))}</span>`}<button class="btn-ghost" id="closeEnd">${esc(t("seeChat"))}</button></div></div>`;
  const a=$("#againBtn"); if(a) a.onclick=()=>send({t:"again"});
  $("#closeEnd").onclick=()=>{ APP.ui.endClosed=true; renderEnd(); };
}

/* ---------- modals ---------- */
function renderModal(force){
  let el=$("#modal"); const m=APP.ui.modal;
  if(!m){ if(el) el.remove(); return; }
  if(el&&!force&&el._m===m) return; // already shown: keep what the player is typing
  if(el) el._m=m;
  if(!el){ el=document.createElement("div"); el.id="modal"; el.className="modal"; el._m=m; document.body.appendChild(el); el.onclick=e=>{ if(e.target===el&&APP.ui.modal&&APP.ui.modal.kind!=="create"){ APP.ui.modal=null; render(); } }; }
  if(m.kind==="create"){ el.innerHTML=createModal(m); bindCreate(m); return; }
  if(m.kind==="settings"){
    const sw=(id,on,ic,title,desc)=>`<label class="opt"><span class="opt-ic">${ic}</span><span class="opt-t"><b>${esc(title)}</b><small>${esc(desc)}</small></span><span class="switch"><input type="checkbox" id="${id}" ${on?"checked":""}><i></i></span></label>`;
    const th=APP.set.theme||"village";
    const themes=[["forest","🌲",t("th_forest"),t("th_forest_d")],["camp","⛺",t("th_camp"),t("th_camp_d")],["village","🔥",t("th_village"),t("th_village_d")],["winter","❄️",t("th_winter"),t("th_winter_d")],["classic","🖼️",t("th_classic"),t("th_classic_d")]];
    el.innerHTML=`<div class="mcard settings"><h2>⚙︎ ${esc(t("settings"))}</h2>
      <div class="frm"><label>${esc(t("language"))}</label><div class="seg"><button data-l="fr" class="${LANG==="fr"?"on":""}">Français</button><button data-l="ru" class="${LANG==="ru"?"on":""}">Русский</button><button data-l="en" class="${LANG==="en"?"on":""}">English</button></div></div>
      <div class="frm"><label>${esc(t("decor"))}</label><div class="themes">${themes.map(([k,ic,n,d])=>`<button class="theme ${th===k?"on":""}" data-th="${k}"><span class="th-ic">${ic}</span><b>${esc(n)}</b><small>${esc(d)}</small></button>`).join("")}</div><p class="muted sm">${esc(t("decorHelp"))}</p></div>
      <div class="frm"><label>${esc(t("gfx"))}</label><div class="seg">${["low","med","high"].map(k=>`<button data-gq="${k}" class="${(APP.set.gq||"med")===k?"on":""}">${esc(t("gfx_"+k))}</button>`).join("")}</div><p class="muted sm">${esc(t("gfxHelp"))}</p></div>
      <div class="frm"><label>${esc(t("chatOpts"))}</label>${sw("sTr",APP.set.tr,"🌐",t("optTr"),t("optTrD"))}</div>
      <div class="frm"><label>${esc(t("soundOpts"))}</label>
        ${sw("sFx",APP.set.sfx!==false,"🔔",t("optFx"),t("optFxD"))}
        ${sw("sAmb",APP.set.amb!==false,"🌙",t("optAmb"),t("optAmbD"))}
        ${sw("sVc",!APP.set.vmute,"🎧",t("optVc"),t("optVcD"))}
        <div class="opt vol"><span class="opt-ic">🔊</span><span class="opt-t"><b>${esc(t("volume"))}</b></span><input type="range" id="sVol" min="0" max="1" step="0.05" value="${APP.set.vol!=null?APP.set.vol:.7}"></div></div>
      <div class="frm"><label>${esc(t("micT"))}</label>
        <div class="opt"><span class="opt-ic">🎙️</span><span class="opt-t"><b>${esc(t("micDev"))}</b></span><select id="sMic" class="msel"><option value="">${esc(t("micDefault"))}</option></select></div>
        <div class="opt vol"><span class="opt-ic">🎚️</span><span class="opt-t"><b>${esc(t("micGain"))}</b></span><input type="range" id="sMicG" min="0.2" max="3" step="0.05" value="${APP.set.micGain!=null?APP.set.micGain:1}"></div>
        <div class="opt mtest"><button type="button" class="btn-ghost sm" id="sMicT">${esc(t(VOICE.testing?"micStop":"micTest"))}</button><span class="mlvl"><i></i></span><label class="mhear"><input type="checkbox" id="sMicHear"> ${esc(t("micHear"))}</label></div>
        ${sw("sNs",APP.set.nsup!==false,"🧹",t("optNs"),t("optNsD"))}
        <div class="opt" id="spkRow" hidden><span class="opt-ic">🔈</span><span class="opt-t"><b>${esc(t("spkDev"))}</b></span><select id="sSpk" class="msel"><option value="">${esc(t("micDefault"))}</option></select></div>
        <p class="muted sm">${esc(t("micHint"))}</p></div>
      <div class="mfoot"><button class="btn-primary" id="sOk">OK</button></div></div>`;
    el.querySelectorAll("[data-l]").forEach(b=>b.onclick=()=>{ setLang(b.dataset.l); });
    el.querySelectorAll("[data-gq]").forEach(b=>b.onclick=()=>{ APP.set.gq=b.dataset.gq; saveSettings(); V3.setQuality(APP.set.gq); if(APP.hero3d) APP.hero3d.setQuality(APP.set.gq==="low"?"low":"med"); renderModal(true); });
    el.querySelectorAll("[data-th]").forEach(b=>b.onclick=()=>{ APP.set.theme=b.dataset.th; saveSettings(); applyTheme(); renderModal(true); });
    $("#sTr").onchange=e=>{ APP.set.tr=e.target.checked; saveSettings(); if(APP.view==="game"){ renderComposer(); renderChat(); } };
    $("#sFx").onchange=e=>{ APP.set.sfx=e.target.checked; saveSettings(); if(e.target.checked) AUD.play("ping"); };
    const fillDev=async()=>{ const d=await VOICE.devices(); const sm=$("#sMic"), ss=$("#sSpk"); if(!sm) return;
      sm.innerHTML=`<option value="">${esc(t("micDefault"))}</option>`+d.mics.filter(x=>x.deviceId&&x.deviceId!=="default").map((x,i)=>`<option value="${esc(x.deviceId)}" ${APP.set.micId===x.deviceId?"selected":""}>${esc(x.label||t("micDev")+" "+(i+1))}</option>`).join("");
      if(d.sinkOk&&d.spks.length){ $("#spkRow").hidden=false; ss.innerHTML=`<option value="">${esc(t("micDefault"))}</option>`+d.spks.filter(x=>x.deviceId&&x.deviceId!=="default").map((x,i)=>`<option value="${esc(x.deviceId)}" ${APP.set.spkId===x.deviceId?"selected":""}>${esc(x.label||t("spkDev")+" "+(i+1))}</option>`).join(""); } };
    fillDev();
    $("#sMic").onchange=e=>{ APP.set.micId=e.target.value||null; saveSettings(); VOICE.reopen(); };
    $("#sSpk").onchange=e=>{ APP.set.spkId=e.target.value||null; saveSettings(); VOICE.setSpeaker(APP.set.spkId); };
    $("#sMicG").oninput=e=>{ APP.set.micGain=+e.target.value; saveSettings(); };
    $("#sNs").onchange=e=>{ APP.set.nsup=e.target.checked; saveSettings(); VOICE.reopen(); };
    $("#sMicT").onclick=async()=>{ VOICE.unlock(); if(VOICE.testing){ await VOICE.test(false); } else { const ok=await VOICE.test(true,$("#sMicHear").checked); if(!ok) toast(t(VOICE.micErr==="denied"?"vMicDenied":"vNoMic")); else fillDev(); } const b=$("#sMicT"); if(b) b.textContent=t(VOICE.testing?"micStop":"micTest"); };
    $("#sMicHear").onchange=e=>{ if(VOICE.testing) VOICE.test(true,e.target.checked); };
    $("#sVc").onchange=e=>{ APP.set.vmute=!e.target.checked; saveSettings(); VOICE.setVolume(); };
    $("#sAmb").onchange=e=>{ APP.set.amb=e.target.checked; saveSettings(); AUD.setVolume(); };
    $("#sVol").oninput=e=>{ APP.set.vol=+e.target.value; saveSettings(); AUD.setVolume(); VOICE.setVolume(); };
    $("#sVol").onchange=()=>AUD.play("ping");
    $("#sOk").onclick=()=>{ if(VOICE.testing) VOICE.test(false); APP.ui.modal=null; render(); };
    return;
  }
  if(m.kind==="why"||m.kind==="cand"){
    const isWhy=m.kind==="why";
    el.innerHTML=`<div class="mcard"><h2>${esc(isWhy?t("whyTitle",{n:pname(m.t)}):t("candTitle"))}</h2><p class="muted">${esc(isWhy?t("whyHelp"):t("candHelp"))}</p>
     <form id="whyF"><input id="whyIn" maxlength="${isWhy?200:300}" placeholder="${esc(isWhy?t("whyPh"):t("candPh"))}" autocomplete="off"><div class="mfoot"><button type="button" class="btn-ghost" id="whyC">${esc(t("cancel"))}</button><button class="btn-primary">${esc(isWhy?t("accuseBtn"):t("candBtn"))}</button></div></form></div>`;
    $("#whyC").onclick=()=>{ APP.ui.modal=null; render(); };
    $("#whyF").onsubmit=e=>{ e.preventDefault(); const x=$("#whyIn").value.trim(); if(x.length<2){ $("#whyIn").focus(); return; }
      const st=S(); if(isWhy) send({t:"act",seq:st.ph.seq,d:{t:m.t,why:x}}); else send({t:"act",seq:V().prompt.seq,d:{x}});
      APP.ui.modal=null; render(); };
  }
}
function renderToast(){ let el=$("#toast"); if(!APP.ui.toast){ if(el) el.remove(); return; } if(!el){ el=document.createElement("div"); el.id="toast"; document.body.appendChild(el); } el.textContent=APP.ui.toast; }

/* ---------- boot ---------- */
(async function boot(){
  await ensureMe();
  const g=parseHash();
  if(g&&APP.me.name){ const saved=lsGet("host."+g.room); APP.view="game"; render(); joinGame(g); }
  else render();
  window.addEventListener("hashchange",()=>{ const g2=parseHash(); if(g2&&APP.view==="hub"&&APP.me.name) joinGame(g2); });
})();
