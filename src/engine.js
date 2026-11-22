/* ===================== HOST ENGINE ===================== */
const WORDS = {
  fr:["parapluie","girafe","chocolat","montagne","bicyclette","sardine","volcan","trompette","citrouille","pingouin","moustache","cerise","fusée","dragon","biscuit","tortue","tambour","nuage","escargot","pantoufle","cactus","boussole","lanterne","grenouille","baguette","tempête","violon","horloge","papillon","ananas"],
  ru:["зонтик","жираф","шоколад","гора","велосипед","сардина","вулкан","труба","тыква","пингвин","усы","вишня","ракета","дракон","печенье","черепаха","барабан","облако","улитка","тапочки","кактус","компас","фонарь","лягушка","багет","буря","скрипка","часы","бабочка","ананас"]
};
WORDS.en=["umbrella","giraffe","chocolate","mountain","bicycle","sardine","volcano","trumpet","pumpkin","penguin","moustache","cherry","rocket","dragon","biscuit","turtle","drum","cloud","snail","slipper","cactus","compass","lantern","frog","baguette","storm","violin","clock","butterfly","pineapple"];
const LETTERS = { en:["d","p","m","c","b","f","g","w"], fr:["d","p","m","c","v","b","f","g"], ru:["д","п","м","к","в","б","з","г"] };
const ANON = ["Ombre","Croc","Griffe","Brume","Cendre","Nuit","Hurle","Givre"];
const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/ё/g,"е");
const NIGHT_ORDER = ["cupid","heir","seer","guard","rat","pyro","wolves","witch","white"];

class Host {
  constructor(cfg){
    Object.assign(this,{players:{},order:[],msgs:[],status:"lobby",ph:{k:"lobby",seq:0},acts:{},sec:null,mseq:0,lastViews:{},cands:[],votes:{},mayor:null,winner:null,winners:[],round:1},cfg);
    this.room=null; this.localSink=null; this._dirty=true; this._lastStateJson=""; this._lastPub=0;
  }
  serial(){ const o={}; for(const k of ["roomId","key","broker","hostKeys","hostId","settings","players","order","msgs","status","ph","acts","sec","mseq","cands","votes","mayor","winner","winners","round"]) o[k]=this[k]; return o; }
  save(){ if(this._saveT) return; this._saveT=setTimeout(()=>{ this._saveT=null; lsSet("host."+this.roomId,this.serial()); },800); }
  attach(room){
    this.room=room;
    room.on("toHost",(from,pub,msg)=>this.onMsg(from,pub,msg));
    if(this._tick) clearInterval(this._tick);
    this._tick=setInterval(()=>this.tick(),400);
    this.flush(true);
  }
  get S(){ return this.settings; }
  dur(k){ const sp=(window.TEST_SPEED)||SPEEDS[this.S.speed]||SPEEDS.normal; return (sp[k]||20)*1000; }
  // ---------- helpers ----------
  P(pid){ return this.players[pid]; }
  R(pid){ return this.sec&&this.sec.R[pid]; }
  alive(pid){ const r=this.R(pid); return !!(r&&r.alive); }
  aliveIds(){ return this.order.filter(p=>this.alive(p)); }
  role(pid){ return this.R(pid)&&this.R(pid).role; }
  camp(pid){ return this.R(pid)&&this.R(pid).camp; }
  aliveWith(roles){ roles=[].concat(roles); return this.aliveIds().filter(p=>roles.includes(this.role(p))); }
  wolfVoters(){ return this.aliveIds().filter(p=>this.camp(p)==="wolf"||this.role(p)==="whiteWolf"); }
  wolfSees(pid){ return this.camp(pid)==="wolf"||this.role(pid)==="whiteWolf"; }
  name(pid){ return (this.P(pid)&&this.P(pid).name)||"?"; }
  isNight(){ return this.ph.k.startsWith("n_"); }
  visible(pid,aud){
    if(this.status==="ended") return true;
    if(aud==="all") return true;
    if(aud==="wolf") return this.wolfSees(pid);
    if(aud==="dead") return (this.sec&&!this.alive(pid)&&this.R(pid)) || this.role(pid)==="necromancer";
    if(aud&&aud.ids) return aud.ids.includes(pid);
    return false;
  }
  // ---------- messaging ----------
  msg(m,aud="all"){
    m.id="m"+(++this.mseq); m.t=Date.now();
    this.msgs.push({m,aud}); if(this.msgs.length>900) this.msgs.splice(0,this.msgs.length-900);
    this.deliver({t:"m",m},aud);
    if(m.x&&this.translator){
      const langs=[...new Set(Object.values(this.players).map(p=>["fr","ru","en"].includes(p.lang)?p.lang:"en"))];
      this.translator(m.x,langs).then(tr=>{ if(!tr) return; m.tr=tr; this.deliver({t:"tr",id:m.id,tr},aud); this.save(); }).catch(e=>console.warn("tr",e));
    }
    this.save();
  }
  deliver(o,aud){
    if(aud==="all"){ if(this.room) this.room.broadcast(o); if(this.localSink) this.localSink.priv(o); }
    else for(const pid of this.order) if(this.visible(pid,aud)) this.sendPriv(pid,o);
  }
  sys(k,p,cls,aud){ this.msg({ch:aud&&aud!=="all"?"ps":"s",k,p:p||{},cls:cls||"info"},aud||"all"); }
  priv(pid,k,p,cls){ this.msg({ch:"ps",k,p:p||{},cls:cls||"priv"},{ids:[pid]}); }
  sendPriv(pid,obj){
    if(pid===this.hostId){ if(this.localSink) this.localSink.priv(obj); return; }
    const P=this.P(pid); if(P&&P.pub&&this.room) this.room.sendTo(pid,P.pub,obj).catch(e=>console.warn(e));
  }
  resync(pid){ const msgs=this.msgs.filter(x=>this.visible(pid,x.aud)).slice(-400).map(x=>x.m); this.lastViews[pid]=null; this.sendPriv(pid,{t:"sync",msgs,v:this.view(pid)}); }
  // ---------- public state ----------
  buildState(){
    const now=Date.now();
    return {
      hostPub:this.hostKeys.pub, room:this.roomId, hostId:this.hostId, status:this.status, round:this.round,
      name:this.S.name, seats:this.S.seats, comp:this.S.comp, mode:this.S.mode, speed:this.S.speed,
      players:this.order.map(pid=>{ const P=this.P(pid),R=this.R(pid); return {
        id:pid, n:P.name, av:P.av, lang:P.lang,
        alive: R?R.alive:true, role: R&&(R.revealed||this.status==="ended")?R.role:null,
        inf: R&&this.status==="ended"?!!R.infected:undefined,
        inact: pid!==this.hostId && now-(P.seen||0)>25000 };}),
      ph:{k:this.ph.k,n:this.ph.n,end:this.ph.end,seq:this.ph.seq,kind:this.ph.data&&this.ph.data.kind,who:this.ph.k==="prompt"||this.ph.k==="d_dict"?this.ph.data&&this.ph.data.who:undefined},
      votes:this.votes, cands:this.cands, mayor:this.mayor, day:this.sec?this.sec.day:0, night:this.sec?this.sec.night:0,
      winner:this.winner, winners:this.winners, lovers:this.status==="ended"&&this.sec?this.sec.lovers:null,
      dict:this.sec&&this.sec.dictPublic||null, oa:!!this.translator, now
    };
  }
  flush(force){
    const st=this.buildState(); const j=JSON.stringify({...st,now:0});
    const now=Date.now();
    if(force||j!==this._lastStateJson||now-this._lastPub>20000){
      this._lastStateJson=j; this._lastPub=now;
      if(this.room) this.room.publishState(st).catch(e=>console.warn(e));
      if(this.localSink) this.localSink.state(st);
    }
    for(const pid of this.order){
      const v=this.view(pid); const vj=JSON.stringify(v);
      if(vj!==this.lastViews[pid]){ this.lastViews[pid]=vj; this.sendPriv(pid,{t:"v",v}); }
    }
    this.save();
  }
  // ---------- private view ----------
  view(pid){
    const R=this.R(pid); const v={me:pid,host:pid===this.hostId};
    if(!R) return v;
    const sec=this.sec, k=this.ph.k;
    Object.assign(v,{role:R.role,orig:R.orig,camp:R.camp,infected:!!R.infected,alive:R.alive});
    if(this.wolfSees(pid)) v.wolves=this.order.filter(p=>this.wolfSees(p));
    if(R.lover){ v.lover=R.lover; v.loverRole=this.role(R.lover); }
    if(R.role==="cupid"&&sec.lovers) v.couple=sec.lovers;
    if(R.role==="sickRat"||sec.contaminated.includes(pid)) v.conta=sec.contaminated.slice();
    if(R.seen&&R.seen.length) v.seen=R.seen;
    if(WITCH_ROLES.includes(R.role)) v.pot={heal:R.heal,poison:R.poison};
    if(R.role==="guard") v.guardLast=R.guardLast||null;
    if(R.role==="pyromancer") v.barrels=sec.barrels.slice();
    if(R.role==="heir"&&R.testator) v.testator=R.testator;
    if(R.role==="mercenary"&&R.mercTarget&&sec.day>=1&&R.camp==="solo") v.merc=R.mercTarget;
    if(R.word) v.word=R.word, v.saidWord=!!R.saidWord;
    if(R.letter) v.letter=R.letter, v.usedLetter=!!R.usedLetter;
    if(this.status!=="running"){ return v; }
    // chat rights
    const night=this.isNight();
    v.chat={v:R.alive&&!night, w:R.alive&&k==="n_wolves"&&this.wolfSees(pid), d:!R.alive||(R.role==="necromancer"&&night), l:!!(R.lover&&R.alive),
            seeW:this.wolfSees(pid)||(R.role==="littleGirl"&&R.alive), seeD:!R.alive||R.role==="necromancer"};
    // prompt
    let pr=null; const a=this.acts[pid];
    if(R.alive){
      if(k==="n_cupid"&&R.role==="cupid") pr={k:"cupid",n:2,self:1};
      else if(k==="n_heir"&&R.role==="heir"&&!R.testator) pr={k:"heir",n:1};
      else if(k==="n_seer"&&SEER_ROLES.includes(R.role)) pr={k:"seer",n:1};
      else if(k==="n_guard"&&R.role==="guard") pr={k:"guard",n:1,self:1,not:R.guardLast||null};
      else if(k==="n_rat"&&R.role==="sickRat") pr={k:"rat",n:2};
      else if(k==="n_pyro"&&R.role==="pyromancer") pr={k:"pyro",n:1,barrels:sec.barrels.slice()};
      else if(k==="n_wolves"&&this.wolfSees(pid)){ pr={k:"wolves",n:1,infect:R.role==="blackWolf"&&!sec.infectUsed}; v.wolfVotes=sec.nt.wolfVotes; }
      else if(k==="n_witch"&&WITCH_ROLES.includes(R.role)) pr={k:"witch",victim:R.heal>0?this.effVictim():null,heal:R.heal,poison:R.poison};
      else if(k==="n_white"&&R.role==="whiteWolf") pr={k:"white",n:1};
      else if(k==="d_dictAsk"&&R.role==="dictator") pr={k:"dictAsk"};
      else if(k==="d_dict"&&R.role==="dictator") pr={k:"dict",n:1};
      else if(k==="d_tie"&&this.mayor===pid) pr={k:"tie",n:1,opts:this.ph.data.opts};
      else if(k==="d_cand"&&!this.cands.includes(pid)) pr={k:"cand"};
    }
    if(k==="prompt"&&this.ph.data.who===pid) pr={k:this.ph.data.kind,n:1,dead:1};
    if(pr){ pr.seq=this.ph.seq; pr.acted=!!a; v.prompt=pr; }
    return v;
  }
  effVictim(){ const nt=this.sec.nt; if(!nt||!nt.victim) return null; if(nt.infect) return null; if(this.protectedFromWolves(nt.victim)) return null; return nt.victim; }
  protectedFromWolves(v){
    const sec=this.sec, nt=sec.nt;
    if(nt&&nt.guarded===v) return true;
    const r=this.role(v);
    if(r==="redRidingHood"){ const h=this.aliveWith("hunter"); if(h.some(x=>!this.R(x).infected)) return true; }
    if(r==="pinkRidingHood"&&sec.lovers&&sec.lovers.every(x=>this.alive(x))) return true;
    if(r==="blueRidingHood"&&this.aliveWith("villager").some(x=>x!==v)) return true;
    return false;
  }
  // ---------- incoming ----------
  onMsg(from,pub,msg){
    let P=this.players[from];
    if(P&&P.pub&&(P.pub.x!==pub.x||P.pub.y!==pub.y)) return; // identity mismatch
    if(P){ P.seen=Date.now(); }
    if(msg.t==="hello"){ this.hello(from,pub,msg); return; }
    if(!P) { this.sendTo0(from,pub,{t:"err",k:"notInGame"}); return; }
    this.handle(from,msg);
  }
  sendTo0(pid,pub,obj){ if(this.room) this.room.sendTo(pid,pub,obj).catch(()=>{}); }
  local(msg){ // host's own client
    const pid=this.hostId;
    if(msg.t==="hello"){ this.hello(pid,this.hostKeys.pub,msg); return; }
    this.handle(pid,msg);
  }
  hello(pid,pub,msg){
    let P=this.players[pid];
    const name=String(msg.name||"").trim().slice(0,18)||"Joueur";
    if(!P){
      if(this.status!=="lobby"&&this.status!=="starting"){ this.sendTo0(pid,pub,{t:"err",k:"started"}); return; }
      if(this.order.length>=this.S.seats){ this.sendTo0(pid,pub,{t:"err",k:"full"}); return; }
      let n=name,i=2; while(Object.values(this.players).some(x=>x.name.toLowerCase()===n.toLowerCase())) n=name+i++;
      P=this.players[pid]={name:n,av:msg.av,lang:msg.lang,pub,seen:Date.now()};
      this.order.push(pid);
      this.sys("joined",{a:{pid}},"small");
      this.checkFull();
    } else { P.av=msg.av||P.av; P.lang=msg.lang||P.lang; P.seen=Date.now(); }
    this.resync(pid); this.flush(true);
  }
  checkFull(){
    if(this.status==="lobby"&&this.order.length>=this.S.seats&&compTotal(this.S.comp)===this.S.seats){
      this.status="starting"; this.ph={k:"starting",seq:this.ph.seq+1,end:Date.now()+this.dur("starting")};
      this.sys("launching",{},"info");
    }
  }
  handle(pid,msg){
    const P=this.P(pid); P.seen=Date.now();
    switch(msg.t){
      case "ping": break;
      case "chat": this.chat(pid,msg); break;
      case "act": this.act(pid,msg); break;
      case "leave":
        if(this.status==="lobby"||this.status==="starting"){
          this.order=this.order.filter(x=>x!==pid); delete this.players[pid];
          this.sys("left",{n:P.name},"small");
          if(this.status==="starting"){ this.status="lobby"; this.ph={k:"lobby",seq:this.ph.seq+1}; }
        }
        break;
      case "cfg": if(pid===this.hostId&&(this.status==="lobby"||this.status==="starting")) this.cfg(msg.cfg); break;
      case "kick": if(pid===this.hostId&&(this.status==="lobby"||this.status==="starting")&&msg.pid!==this.hostId){ const n=this.name(msg.pid); this.sendPriv(msg.pid,{t:"err",k:"kicked"}); this.order=this.order.filter(x=>x!==msg.pid); delete this.players[msg.pid]; this.sys("left",{n},"small"); if(this.status==="starting"){this.status="lobby";this.ph={k:"lobby",seq:this.ph.seq+1};} } break;
      case "again": if(pid===this.hostId&&this.status==="ended") this.again(); break;
      case "forceStart": if(pid===this.hostId&&this.status==="lobby"&&this.order.length>=3){ this.S.seats=this.order.length; this.S.comp=suggestCompFit(this.S.comp,this.order.length); this.checkFull(); } break;
    }
    this.flush();
  }
  cfg(c){
    const S=this.S;
    if(c.name!=null) S.name=String(c.name).slice(0,40);
    if(c.seats!=null){ const s=Math.max(3,Math.min(16,c.seats|0)); if(s>=this.order.length) S.seats=s; }
    if(c.comp) S.comp=c.comp;
    if(c.mode) S.mode=c.mode==="serious"?"serious":"fun";
    if(c.speed) S.speed=c.speed==="fast"?"fast":"normal";
    if(this.status==="starting"&&(this.order.length<S.seats||compTotal(S.comp)!==S.seats)){ this.status="lobby"; this.ph={k:"lobby",seq:this.ph.seq+1}; }
    this.checkFull();
  }
  // ---------- chat ----------
  chat(pid,msg){
    let x=String(msg.x||"").replace(/\s+/g," ").trim().slice(0,400); if(!x) return;
    const ch=msg.ch, P=this.P(pid), m={ch,a:pid,n:P.name,x};
    if(this.status!=="running"){ if(ch==="v") this.msg(m,"all"); return; }
    const R=this.R(pid), night=this.isNight();
    if(ch==="v"){
      if(!R.alive||night) return;
      if(R.role==="talkativeWolf"&&R.word&&!R.saidWord&&norm(x).includes(norm(R.word))){ R.saidWord=true; }
      if(R.role==="literateWolf"&&R.letter&&!R.usedLetter&&norm(x).includes(norm(R.letter))){ R.usedLetter=true; this.priv(pid,"letterUsed",{l:R.letter},"warn"); }
      this.msg(m,"all");
    } else if(ch==="w"){
      if(!R.alive||this.ph.k!=="n_wolves"||!this.wolfSees(pid)) return;
      this.msg(m,"wolf");
      for(const g of this.aliveWith("littleGirl")) if(!this.wolfSees(g)){
        const nt=this.sec.nt; nt.anon=nt.anon||{}; if(!nt.anon[pid]) nt.anon[pid]=ANON[Object.keys(nt.anon).length%ANON.length];
        this.msg({ch:"w",a:"anon:"+nt.anon[pid],n:nt.anon[pid],x,anon:1},{ids:[g]});
      }
    } else if(ch==="d"){
      const necro=R.alive&&R.role==="necromancer";
      if(R.alive&&!(necro&&night)) return;
      if(necro){ m.a=null; m.necro=1; m.n=""; }
      this.msg(m,"dead");
    } else if(ch==="l"){
      if(!R.lover||!R.alive) return;
      this.msg(m,{ids:[pid,R.lover]});
    }
  }
  // ---------- actions ----------
  act(pid,msg){
    if(this.status!=="running") return;
    const R=this.R(pid); const k=this.ph.k; const d=msg.d||{};
    if(msg.seq!==this.ph.seq) return;
    const v=this.view(pid); const pr=v.prompt;
    const validT=(t,{self=false,anyDead=false}={})=>t&&this.players[t]&&(anyDead||this.alive(t))&&(self||t!==pid);
    if(k==="d_vote"||k==="d_elect"){
      if(!R.alive) return;
      let t=d.t||null;
      if(t&&(!validT(t,{self:k==="d_elect"})||(k==="d_elect"&&!this.cands.includes(t)))) return;
      const prev=this.votes[pid]||null; if(prev===t) return;
      if(t){
        if(k==="d_vote"){
          const others=Object.entries(this.votes).filter(([a,b])=>b===t&&a!==pid).length;
          const why=String(d.why||"").replace(/\s+/g," ").trim().slice(0,200);
          if(!others&&!why){ this.sendPriv(pid,{t:"err",k:"needWhy"}); return; }
          this.votes[pid]=t;
          if(!others) this.msg({ch:"v",cls:"accuse",a:pid,n:this.name(pid),x:why,k:"accuse",p:{t:{pid:t}}},"all");
          else this.sys("voted",{a:{pid},t:{pid:t}},"small");
          // majority -> 30s
          const cnt=Object.values(this.votes).filter(x=>x===t).length;
          if(cnt>this.aliveIds().length/2&&this.ph.end-Date.now()>30500){ this.ph.end=Date.now()+30000; this.sys("timerCut",{t:{pid:t}},"info"); }
        } else { this.votes[pid]=t; this.sys("votedMayor",{a:{pid},t:{pid:t}},"small"); }
      } else { delete this.votes[pid]; this.sys("unvoted",{a:{pid}},"small"); }
      return;
    }
    if(!pr||pr.seq!==this.ph.seq) return;
    if(pr.k==="cand"){ const why=String(d.x||"").replace(/\s+/g," ").trim().slice(0,300); this.cands.push(pid); this.msg({ch:"v",cls:"pres",a:pid,n:this.name(pid),x:why,k:"presents"},"all"); return; }
    let ok=false;
    switch(pr.k){
      case "cupid": ok=Array.isArray(d.ts)&&d.ts.length===2&&d.ts[0]!==d.ts[1]&&d.ts.every(t=>validT(t,{self:true})); break;
      case "heir": case "seer": case "white": case "dict": ok=validT(d.t); break;
      case "guard": ok=validT(d.t,{self:true})&&d.t!==R.guardLast; break;
      case "rat": ok=Array.isArray(d.ts)&&d.ts.length>=1&&d.ts.length<=2&&d.ts.every(t=>validT(t))&&new Set(d.ts).size===d.ts.length; break;
      case "pyro": ok=d.ignite===true||(validT(d.t)&&!this.sec.barrels.includes(d.t)); break;
      case "wolves": ok=validT(d.t)&&!(this.camp(d.t)==="wolf"); break;
      case "witch": ok=d.skip===true||(d.heal===true&&R.heal>0&&!!pr.victim)||(validT(d.poison)&&R.poison>0); break;
      case "dictAsk": ok=typeof d.yes==="boolean"; break;
      case "tie": ok=pr.opts.includes(d.t); break;
      case "hunter": ok=d.none===true||validT(d.t); break;
      case "grave": ok=validT(d.t,{anyDead:true}); break;
      case "succ": ok=validT(d.t); break;
    }
    if(!ok) return;
    if(pr.k==="wolves"){
      const nt=this.sec.nt; nt.wolfVotes[pid]=d.t; if(d.infect!=null&&R.role==="blackWolf") nt.infectWish=!!d.infect;
      this.acts[pid]=d;
      this.sys("wolfVote",{a:{pid},t:{pid:d.t}},"wolfsys","wolf");
    } else {
      if(this.acts[pid]&&pr.k!=="wolves") return; // single action
      this.acts[pid]=d;
    }
    if(pr.k==="seer") this.seerResult(pid,d.t);
    this.checkDone();
  }
  seerResult(pid,t){
    const R=this.R(pid), r=this.role(t);
    R.seen=R.seen||[];
    if(R.role==="auraSeer"){ const dark=!!(ROLES[r]&&ROLES[r].kill); R.seen.push({t,aura:dark?"dark":"light"}); this.priv(pid,"auraResult",{t:{pid:t},a:dark?"auraDark":"auraLight"},"seer"); }
    else { R.seen.push({t,r}); this.priv(pid,"seerResult",{t:{pid:t},r:{role:r}},"seer"); if(R.role==="talkativeSeer") this.sec.nt.talk.push({t,r}); }
  }
  actors(){
    const k=this.ph.k;
    const m={n_cupid:()=>this.aliveWith("cupid"),n_heir:()=>this.aliveWith("heir").filter(p=>!this.R(p).testator),n_seer:()=>this.aliveWith(SEER_ROLES),n_guard:()=>this.aliveWith("guard"),
      n_rat:()=>this.aliveWith("sickRat"),n_pyro:()=>this.aliveWith("pyromancer"),n_wolves:()=>this.wolfVoters(),n_witch:()=>this.aliveWith(WITCH_ROLES).filter(p=>this.R(p).heal>0||this.R(p).poison>0),
      n_white:()=>this.aliveWith("whiteWolf"),d_dictAsk:()=>this.aliveWith("dictator"),d_dict:()=>this.aliveWith("dictator"),d_tie:()=>this.mayor&&this.alive(this.mayor)?[this.mayor]:[],
      prompt:()=>[this.ph.data.who]};
    return m[k]?m[k]():null;
  }
  checkDone(){
    const a=this.actors(); if(!a) return;
    let done=a.length>0&&a.every(p=>this.acts[p]);
    if(this.ph.k==="n_wolves"&&done){ const vs=a.map(p=>this.sec.nt.wolfVotes[p]); done=vs.every(x=>x===vs[0]); }
    if(done&&!this.ph.doneAt) this.ph.doneAt=Date.now()+(this.ph.k==="n_wolves"?2500:1200);
    if(!done) this.ph.doneAt=null;
  }
  // ---------- phase machine ----------
  setPhase(k,durKey,data,n){
    this.ph={k,seq:this.ph.seq+1,end:Date.now()+this.dur(durKey),data:data||{},n:n!=null?n:(k.startsWith("n_")?this.sec.night:this.sec.day)};
    this.acts={};
    if(k.startsWith("n_")) this.sys("step_"+k.slice(2),{},"step");
    this.checkDone();
    this.flush();
  }
  tick(){
    try{
      const now=Date.now();
      if(this.status==="starting"&&now>=this.ph.end){ this.startGame(); return; }
      if(this.status!=="running"){ this.flush(); return; }
      if(this.ph.k==="d_vote"&&!this.sec.mentalistDone&&this.ph.end-now<=30000){ this.sec.mentalistDone=true; this.mentalist(); }
      if(now>=this.ph.end||(this.ph.doneAt&&now>=this.ph.doneAt)) this.endPhase();
      else this.flush();
    }catch(e){ console.error("tick",e); }
  }
  mentalist(){
    const ms=this.aliveWith("mentalist"); if(!ms.length) return;
    const c={}; for(const t of Object.values(this.votes)) c[t]=(c[t]||0)+1;
    let best=null,max=0,tie=false; for(const t in c){ if(c[t]>max){max=c[t];best=t;tie=false;} else if(c[t]===max) tie=true; }
    const res=!best||tie?"mentNone":this.camp(best)==="wolf"?"mentGood":"mentBad";
    for(const m of ms) this.priv(m,res,best&&!tie?{t:{pid:best}}:{},"seer");
  }
  startGame(){
    const S=this.S; const deck=[];
    for(const r in S.comp) for(let i=0;i<(S.comp[r]||0);i++) deck.push(r);
    while(deck.length<this.order.length) deck.push("villager");
    const roles=shuffle(deck).slice(0,this.order.length);
    this.sec={R:{},day:0,night:0,lovers:null,contaminated:[],barrels:[],infectUsed:false,firstDeath:false,pending:[],after:null,nt:null,mentalistDone:false,mayorDone:false,dictPublic:null};
    this.order.forEach((pid,i)=>{ const r=roles[i]; this.sec.R[pid]={role:r,orig:r,camp:ROLES[r].camp,alive:true,
      heal:r==="witch"?1:r==="healerWitch"?2:0, poison:r==="witch"?1:r==="poisoner"?2:0}; });
    for(const pid of this.aliveWith("mercenary")){ const o=this.order.filter(x=>x!==pid); this.R(pid).mercTarget=pick(o); }
    this.status="running"; this.mayor=null; this.votes={}; this.cands=[]; this.winner=null; this.winners=[];
    this.sys("gameStart",{n:this.order.length},"big");
    for(const pid of this.order) this.priv(pid,"yourRole",{r:{role:this.role(pid)}},"role");
    for(const pid of this.order) this.resync(pid);
    this.startNight();
  }
  startNight(){
    const sec=this.sec; sec.night++; this.votes={}; this.cands=[];
    sec.nt={wolfVotes:{},victim:null,infect:false,infectWish:false,guarded:null,healed:false,poisons:[],white:null,ignite:false,talk:[],idx:-1};
    this.sys("nightFalls",{n:sec.night},"night");
    this.nextNightStep();
  }
  stepActive(s){
    const n=this.sec.night;
    switch(s){
      case "cupid": return n===1&&this.aliveWith("cupid").length>0;
      case "heir": return n===1&&this.aliveWith("heir").some(p=>!this.R(p).testator);
      case "seer": return this.aliveWith(SEER_ROLES).length>0;
      case "guard": return this.aliveWith("guard").length>0;
      case "rat": return this.aliveWith("sickRat").length>0;
      case "pyro": return this.aliveWith("pyromancer").length>0;
      case "wolves": return this.wolfVoters().length>0;
      case "witch": return this.aliveWith(WITCH_ROLES).some(p=>this.R(p).heal>0||this.R(p).poison>0);
      case "white": return n>=2&&n%2===0&&this.aliveWith("whiteWolf").length>0;
    }
  }
  nextNightStep(){
    const nt=this.sec.nt;
    for(let i=nt.idx+1;i<NIGHT_ORDER.length;i++){ if(this.stepActive(NIGHT_ORDER[i])){ nt.idx=i; this.setPhase("n_"+NIGHT_ORDER[i],NIGHT_ORDER[i]); return; } }
    this.dawn();
  }
  endPhase(){
    const k=this.ph.k, sec=this.sec, nt=sec.nt, A=this.acts;
    const one=role=>{ const p=this.aliveWith(role)[0]; return p?[p,A[p]]:[null,null]; };
    switch(k){
      case "n_cupid": { const [p,a]=one("cupid"); if(a&&a.ts){ const [x,y]=a.ts; sec.lovers=[x,y]; this.R(x).lover=y; this.R(y).lover=x;
          this.priv(x,"inLove",{t:{pid:y},r:{role:this.role(y)}},"love"); this.priv(y,"inLove",{t:{pid:x},r:{role:this.role(x)}},"love");
          if(p!==x&&p!==y) this.priv(p,"cupidDone",{a:{pid:x},b:{pid:y}},"love"); }
        this.nextNightStep(); return; }
      case "n_heir": for(const p of this.aliveWith("heir")) if(A[p]&&A[p].t){ this.R(p).testator=A[p].t; this.priv(p,"heirChose",{t:{pid:A[p].t}},"priv"); } this.nextNightStep(); return;
      case "n_seer": this.nextNightStep(); return;
      case "n_guard": for(const p of this.aliveWith("guard")){ const t=A[p]&&A[p].t||null; this.R(p).guardLast=t; nt.guarded=t; } this.nextNightStep(); return;
      case "n_rat": for(const p of this.aliveWith("sickRat")) if(A[p]&&A[p].ts){ for(const t of A[p].ts) if(!sec.contaminated.includes(t)){ sec.contaminated.push(t); this.priv(t,"contaminated",{},"conta"); } } this.nextNightStep(); return;
      case "n_pyro": for(const p of this.aliveWith("pyromancer")){ const a=A[p]; if(a&&a.ignite) nt.ignite=true; else if(a&&a.t){ sec.barrels.push(a.t); } } this.nextNightStep(); return;
      case "n_wolves": {
        const c={}; for(const p of this.wolfVoters()){ const t=nt.wolfVotes[p]; if(t&&this.alive(t)&&this.camp(t)!=="wolf") c[t]=(c[t]||0)+1; }
        let max=0,best=[]; for(const t in c){ if(c[t]>max){max=c[t];best=[t];} else if(c[t]===max) best.push(t); }
        nt.victim=best.length?pick(best):null;
        nt.infect=!!(nt.infectWish&&!sec.infectUsed&&this.aliveWith("blackWolf").length&&nt.victim&&!this.protectedFromWolves(nt.victim));
        if(nt.victim) this.sys("wolvesChose",{t:{pid:nt.victim}},"wolfsys","wolf");
        this.nextNightStep(); return; }
      case "n_witch": for(const p of this.aliveWith(WITCH_ROLES)){ const a=A[p],R=this.R(p); if(!a||a.skip) continue;
          if(a.heal&&R.heal>0&&this.effVictim()){ R.heal--; nt.healed=true; }
          else if(a.poison&&R.poison>0&&this.alive(a.poison)){ R.poison--; nt.poisons.push(a.poison); } }
        this.nextNightStep(); return;
      case "n_white": { const [p,a]=one("whiteWolf"); if(a&&a.t) nt.white=a.t; this.nextNightStep(); return; }
      case "prompt": this.endPrompt(); return;
      case "d_cand": if(!this.cands.length) this.cands=this.aliveIds(); this.votes={}; this.setPhase("d_elect","elect"); return;
      case "d_elect": {
        const c={}; for(const t of Object.values(this.votes)) if(this.cands.includes(t)&&this.alive(t)) c[t]=(c[t]||0)+1;
        let max=0,best=[]; for(const t in c){ if(c[t]>max){max=c[t];best=[t];} else if(c[t]===max) best.push(t); }
        const m=best.length?pick(best):pick(this.cands.filter(x=>this.alive(x))); this.mayor=m||null; sec.mayorDone=true; this.votes={}; this.cands=[];
        if(m) this.sys("mayorElected",{t:{pid:m}},"mayor");
        this.afterElection(); return; }
      case "d_dictAsk": { const [p,a]=one("dictator"); if(p&&a&&a.yes){ this.R(p).dictUsed=true; sec.dictPublic=p; this.sys("coup",{t:{pid:p}},"big"); this.setPhase("d_dict","dict",{who:p}); } else this.setPhase("d_vote","vote"); return; }
      case "d_dict": { const p=this.ph.data.who; const a=A[p]; sec.dictPublic=null;
        if(a&&a.t&&this.alive(a.t)&&this.alive(p)){ const wolf=this.camp(a.t)==="wolf"; this.kill(a.t,"dict");
          if(wolf){ this.mayor=p; this.sys("dictWin",{t:{pid:p}},"mayor"); } else this.kill(p,"dictFail"); }
        else this.sys("dictNothing",{},"info");
        this.finishDay(); return; }
      case "d_vote": this.resolveVote(); return;
      case "d_tie": { const a=A[this.mayor]; if(a&&a.t) this.lynch(a.t); else this.sys("tieNobody",{},"info"); this.finishDay(); return; }
    }
  }
  dawn(){
    const sec=this.sec, nt=sec.nt; const deaths=[];
    let v=this.effVictim();
    if(nt.victim&&nt.infect&&!this.protectedFromWolves(nt.victim)){ this.infect(nt.victim); sec.infectUsed=true; v=null; }
    if(v&&!nt.healed) deaths.push([v,"wolf"]);
    for(const t of nt.poisons) deaths.push([t,"poison"]);
    if(nt.white) deaths.push([nt.white,"white"]);
    const pyro=this.aliveWith("pyromancer")[0];
    if(nt.ignite&&pyro&&!deaths.some(d=>d[0]===pyro)){ for(const b of sec.barrels) deaths.push([b,"fire"]); sec.barrels=[]; this.sys("explosion",{},"big"); }
    this.ph={k:"dawn",seq:this.ph.seq+1,end:Date.now()+this.dur("dawn"),data:{},n:sec.night}; this.acts={};
    this.sys("dawn",{},"day");
    for(const x of nt.talk) this.sys("talkSeer",{t:{pid:x.t},r:{role:x.r}},"seer");
    const seen=new Set(); const list=deaths.filter(([p])=>this.alive(p)&&!seen.has(p)&&seen.add(p));
    if(!list.length) this.sys("noDeath",{},"info");
    for(const [p,c] of list) this.kill(p,c);
    if(sec.night===1) for(const p of this.aliveWith("mercenary")) this.priv(p,"mercTarget",{t:{pid:this.R(p).mercTarget}},"priv");
    sec.after="day"; this.runPending();
  }
  infect(v){ const R=this.R(v); R.infected=true; R.camp="wolf"; this.priv(v,"youInfected",{},"wolfsys"); this.sys("joinedPack",{t:{pid:v}},"wolfsys","wolf"); this.resync(v); }
  kill(pid,cause){
    const R=this.R(pid); if(!R||!R.alive) return;
    R.alive=false; R.revealed=true;
    this.sys("died",{t:{pid},r:{role:R.role},c:"c_"+cause,inf:R.infected?1:0},"death");
    const sec=this.sec;
    if(R.role==="hunter") sec.pending.push({kind:"hunter",who:pid});
    if(R.role==="gravedigger") sec.pending.push({kind:"grave",who:pid});
    if(this.mayor===pid) sec.pending.push({kind:"succ",who:pid});
    for(const h of this.aliveWith("heir")) if(this.R(h).testator===pid) this.inherit(h,pid);
    if(!sec.firstDeath){ sec.firstDeath=true; for(const h of this.aliveWith("plunderer")) if(h!==pid) this.inherit(h,pid); }
    if(R.lover&&this.alive(R.lover)) this.kill(R.lover,"love");
    this.resync(pid);
  }
  inherit(h,from){
    const r=this.R(from).role, H=this.R(h), was=H.role;
    if(r==="hunter"||r==="gravedigger"){ this.priv(h,"inheritNothing",{t:{pid:from}},"priv"); H.testator=null; return; }
    H.role=r; H.testator=null;
    const F=this.R(from); H.heal=F.heal||0; H.poison=F.poison||0; H.dictUsed=F.dictUsed; H.guardLast=null;
    if(r==="mercenary"){ H.mercTarget=F.mercTarget; }
    H.camp=H.infected?"wolf":(r==="mercenary"&&this.sec.day>1?"village":ROLES[r].camp);
    this.priv(h,"inherited",{t:{pid:from},r:{role:r}},"role");
    if(H.camp==="wolf"&&!H.infected){ this.sys("joinedPack",{t:{pid:h}},"wolfsys","wolf"); }
    this.resync(h);
  }
  runPending(){
    if(this.checkWin()) return;
    const p=this.sec.pending.shift();
    if(!p){ this.continueAfter(); return; }
    if(p.kind==="succ"&&!this.aliveIds().length){ this.runPending(); return; }
    this.setPhase("prompt","prompt",{kind:p.kind,who:p.who});
  }
  endPrompt(){
    const {kind,who}=this.ph.data; const a=this.acts[who]||{};
    if(kind==="hunter"){ if(a.t&&this.alive(a.t)) { this.sys("hunterShot",{a:{pid:who},t:{pid:a.t}},"big"); this.kill(a.t,"hunter"); } else this.sys("hunterNone",{},"info"); }
    else if(kind==="grave"){
      const t=a.t&&this.players[a.t]?a.t:pick(this.order.filter(x=>x!==who));
      if(t){ const wolf=this.camp(t)==="wolf"; const pool=this.order.filter(x=>x!==who&&x!==t&&((this.camp(x)==="wolf")!==wolf)); const o=pool.length?pick(pool):null;
        const pair=shuffle([t,o].filter(Boolean)); this.sys("graves",{a:{pid:pair[0]},b:pair[1]?{pid:pair[1]}:"—"},"big"); }
    } else if(kind==="succ"){
      const al=this.aliveIds(); const t=a.t&&this.alive(a.t)?a.t:pick(al); this.mayor=t||null; if(t) this.sys("newMayor",{t:{pid:t}},"mayor");
    }
    this.runPending();
  }
  continueAfter(){ const a=this.sec.after; this.sec.after=null; if(a==="day") this.startDay(); else this.startNight(); }
  startDay(){
    const sec=this.sec; sec.day++; this.votes={}; sec.mentalistDone=false;
    for(const p of this.aliveWith("talkativeWolf")){ const R=this.R(p),L=WORDS[this.P(p).lang]?this.P(p).lang:"fr"; R.word=pick(WORDS[L]); R.saidWord=false; this.priv(p,"yourWord",{w:R.word},"warn"); }
    for(const p of this.aliveWith("literateWolf")){ const R=this.R(p),L=WORDS[this.P(p).lang]?this.P(p).lang:"fr"; R.letter=pick(LETTERS[L]); R.usedLetter=false; this.priv(p,"yourLetter",{l:R.letter},"warn"); }
    if(sec.day===2&&!sec.mayorDone&&this.aliveIds().length>=3){ this.cands=[]; this.setPhase("d_cand","cand"); return; }
    this.afterElection();
  }
  afterElection(){
    const d=this.aliveWith("dictator").filter(p=>!this.R(p).dictUsed);
    if(d.length) this.setPhase("d_dictAsk","dictAsk");
    else this.setPhase("d_vote","vote");
  }
  resolveVote(){
    const c={}; for(const [v,t] of Object.entries(this.votes)) if(this.alive(v)&&this.alive(t)) c[t]=(c[t]||0)+1;
    let max=0,best=[]; for(const t in c){ if(c[t]>max){max=c[t];best=[t];} else if(c[t]===max) best.push(t); }
    if(best.length>1){
      if(this.mayor&&this.alive(this.mayor)){ this.sys("tieMayor",{t:{pid:this.mayor}},"info"); this.setPhase("d_tie","tie",{opts:best}); return; }
      this.sys("tieNobody",{},"info");
    } else if(best.length===1) this.lynch(best[0]);
    else this.sys("noVote",{},"info");
    this.finishDay();
  }
  lynch(t){
    if(this.role(t)==="wolfRidingHood"&&this.aliveWith("blackWolf").length){ this.sys("cwSaved",{t:{pid:t}},"info"); return; }
    this.kill(t,"vote");
    const sec=this.sec;
    if(sec.day===1) for(const m of this.aliveWith("mercenary")) if(this.R(m).camp==="solo"&&this.R(m).mercTarget===t) sec.mercWin=m;
  }
  finishDay(){
    const sec=this.sec; this.votes={};
    for(const p of this.aliveWith("talkativeWolf")) if(this.R(p).word&&!this.R(p).saidWord) this.kill(p,"word");
    for(const p of this.aliveWith("literateWolf")) if(this.R(p).usedLetter) this.kill(p,"letter");
    for(const p of this.order){ const R=this.R(p); R.word=null; R.letter=null; }
    if(sec.mercWin){ this.endGame("merc",[sec.mercWin]); return; }
    if(sec.day===1) for(const m of this.order) if(this.role(m)==="mercenary"&&this.R(m).camp==="solo"){ this.R(m).camp="village"; if(this.alive(m)) this.priv(m,"mercFailed",{},"priv"); }
    sec.after="night"; this.runPending();
  }
  checkWin(){
    if(this.status!=="running") return true;
    const al=this.aliveIds(), sec=this.sec;
    if(!al.length){ this.endGame("draw",[]); return true; }
    const L=sec.lovers;
    if(L&&al.length===2&&L.every(x=>this.alive(x))&&this.camp(L[0])!==this.camp(L[1])){ this.endGame("lovers",L.slice()); return true; }
    if(al.length===1&&this.role(al[0])==="whiteWolf"){ this.endGame("white",al.slice()); return true; }
    const rat=this.aliveWith("sickRat")[0];
    if(rat&&al.filter(x=>x!==rat).every(x=>sec.contaminated.includes(x))&&al.length>1){ this.endGame("rat",[rat]); return true; }
    if(al.every(x=>this.camp(x)==="wolf")){ this.endGame("wolf",this.order.filter(x=>this.camp(x)==="wolf")); return true; }
    if(!al.some(x=>this.camp(x)==="wolf"||this.camp(x)==="solo")){ this.endGame("village",this.order.filter(x=>this.camp(x)==="village")); return true; }
    return false;
  }
  endGame(w,winners){
    this.status="ended"; this.winner=w; this.winners=winners; this.ph={k:"ended",seq:this.ph.seq+1,n:0}; this.acts={};
    for(const p of this.order) this.R(p).revealed=true;
    this.sys("win_"+w,{},"win");
    for(const p of this.order) this.resync(p);
    this.flush(true);
  }
  again(){
    this.status="lobby"; this.sec=null; this.ph={k:"lobby",seq:this.ph.seq+1}; this.acts={}; this.votes={}; this.cands=[]; this.mayor=null; this.winner=null; this.winners=[]; this.round++;
    const now=Date.now();
    for(const pid of this.order.slice()) if(pid!==this.hostId&&now-(this.P(pid).seen||0)>30000){ this.order=this.order.filter(x=>x!==pid); delete this.players[pid]; }
    if(this.order.length>this.S.seats) this.S.seats=this.order.length;
    this.sys("newRound",{},"big");
    for(const p of this.order) this.resync(p);
    this.checkFull(); this.flush(true);
  }
}
function suggestCompFit(comp,n){
  const c=clone(comp||{}); let tot=compTotal(c);
  while(tot>n){ if(c.villager>0){c.villager--;} else { const ks=Object.keys(c).filter(k=>c[k]>0&&!(k==="werewolf"&&c[k]===1)); const k=ks.reverse().find(k=>k!=="werewolf")||ks[0]; if(!k) break; c[k]--; } tot--; }
  if(tot<n) c.villager=(c.villager||0)+(n-tot);
  for(const k in c) if(!c[k]) delete c[k];
  return c;
}
