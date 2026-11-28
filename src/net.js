/* ===================== UTIL / CRYPTO / NET ===================== */
const QS = new URLSearchParams(location.search);
const LSP = "hl." + (QS.get("u")||"") + ".";
function lsGet(k){ try{ return JSON.parse(localStorage.getItem(LSP+k)); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(LSP+k, JSON.stringify(v)); }catch(e){} }
function lsDel(k){ try{ localStorage.removeItem(LSP+k); }catch(e){} }
function rid(n=8){ const a="abcdefghijkmnpqrstuvwxyz23456789"; let s=""; const r=crypto.getRandomValues(new Uint8Array(n)); for(const x of r) s+=a[x%a.length]; return s; }
function b64(buf){ const u=new Uint8Array(buf); let s=""; for(let i=0;i<u.length;i++) s+=String.fromCharCode(u[i]); return btoa(s); }
function ub64(s){ const b=atob(s); const u=new Uint8Array(b.length); for(let i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u; }
const b64u = buf => b64(buf).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const ub64u = s => ub64(s.replace(/-/g,"+").replace(/_/g,"/") + "===".slice((s.length+3)%4));
const enc = new TextEncoder(), dec = new TextDecoder();
const clone = o => JSON.parse(JSON.stringify(o));
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
const pick = a => a[Math.floor(Math.random()*a.length)];

const Crypto = {
  async genECDH(){
    const kp = await crypto.subtle.generateKey({name:"ECDH",namedCurve:"P-256"},true,["deriveKey"]);
    return {pub: await crypto.subtle.exportKey("jwk",kp.publicKey), priv: await crypto.subtle.exportKey("jwk",kp.privateKey)};
  },
  _priv:new Map(), _pair:new Map(), _room:new Map(),
  async privKey(jwk){ const k=JSON.stringify(jwk); if(!this._priv.has(k)) this._priv.set(k, crypto.subtle.importKey("jwk",jwk,{name:"ECDH",namedCurve:"P-256"},false,["deriveKey"])); return this._priv.get(k); },
  async pairKey(myPrivJwk, otherPubJwk){
    const id = JSON.stringify(myPrivJwk.d)+"|"+otherPubJwk.x+otherPubJwk.y;
    if(!this._pair.has(id)) this._pair.set(id,(async()=>{
      const pub = await crypto.subtle.importKey("jwk",otherPubJwk,{name:"ECDH",namedCurve:"P-256"},false,[]);
      return crypto.subtle.deriveKey({name:"ECDH",public:pub}, await this.privKey(myPrivJwk), {name:"AES-GCM",length:256}, false, ["encrypt","decrypt"]);
    })());
    return this._pair.get(id);
  },
  async roomKey(raw){ if(!this._room.has(raw)) this._room.set(raw, crypto.subtle.importKey("raw",ub64u(raw),"AES-GCM",false,["encrypt","decrypt"])); return this._room.get(raw); },
  async seal(key,obj){ const iv=crypto.getRandomValues(new Uint8Array(12)); const c=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,enc.encode(JSON.stringify(obj))); return {iv:b64(iv),c:b64(c)}; },
  async open(key,box){ const p=await crypto.subtle.decrypt({name:"AES-GCM",iv:ub64(box.iv)},key,ub64(box.c)); return JSON.parse(dec.decode(p)); }
};

/* ---- Transports: MQTT relay (default) or local BroadcastChannel (tests) ---- */
const BROKERS = ["wss://broker.emqx.io:8084/mqtt","wss://broker.hivemq.com:8884/mqtt","wss://test.mosquitto.org:8081/mqtt"];
function brokerURL(i){ return BROKERS[i]; } // le proxy, quand il y en a un, est géré par l’appli (Electron / Android)
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }

class LocalTransport {
  constructor(){ this.subs=new Set(); this.h=null; this.status="online"; }
  async connect(){
    this.bc = new BroadcastChannel("hl-bus");
    this.bc.onmessage = e => this._deliver(e.data.topic, e.data.payload);
    return 0;
  }
  _match(t){ return this.subs.has(t); }
  _deliver(topic,payload){ if(this._match(topic) && this.h) this.h(topic,payload); }
  sub(topic){ this.subs.add(topic); try{ const r=localStorage.getItem("hlret:"+topic); if(r) setTimeout(()=>this._deliver(topic,r),5); }catch(e){} }
  pub(topic,payload,retain){ if(retain){ try{ localStorage.setItem("hlret:"+topic,payload);}catch(e){} } this.bc.postMessage({topic,payload}); setTimeout(()=>this._deliver(topic,payload),0); }
  onMessage(h){ this.h=h; }
  onStatus(){}
}
class MqttTransport {
  constructor(){ this.h=null; this.subs=new Set(); this.statusH=()=>{}; }
  async connect(pref){
    if(typeof mqtt==="undefined"){
      try{ await loadScript("https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js"); }
      catch(e){ await loadScript("https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js"); }
    }
    const order = pref!=null ? [pref, ...BROKERS.map((_,i)=>i).filter(i=>i!==pref)] : BROKERS.map((_,i)=>i);
    for(const i of order){
      const ok = await new Promise(res=>{
        const c = mqtt.connect(brokerURL(i),{clientId:"hl_"+rid(12),clean:true,keepalive:20,reconnectPeriod:2000,connectTimeout:12000,resubscribe:false});
        const to=setTimeout(()=>{ c.end(true); res(null); },13000);
        c.once("connect",()=>{ clearTimeout(to); res(c); });
        c.once("error",()=>{});
      });
      if(ok){
        this.c=ok; this.idx=i;
        ok.on("message",(t,m)=>{ if(this.h) this.h(t,m.toString()); });
        ok.on("connect",()=>{ this.statusH("online"); for(const s of this.subs) ok.subscribe(s,{qos:1}); });
        ok.on("offline",()=>this.statusH("offline"));
        ok.on("reconnect",()=>this.statusH("reconnecting"));
        return i;
      }
      if(pref!=null) break; // everyone must use the same broker
    }
    throw new Error("relay");
  }
  sub(t){ this.subs.add(t); this.c.subscribe(t,{qos:1}); }
  // QoS 1 : le relais accuse réception et renvoie si besoin (sauf la voix, en temps réel)
  pub(t,p,retain,q){ this.c.publish(t,p,{qos:q==null?1:q,retain:!!retain}); }
  onMessage(h){ this.h=h; }
  onStatus(h){ this.statusH=h; }
}
function rtQ(m){ return m&&(m.t==="va"||m.t==="vc"||m.t==="hb"||m.t==="ping")?0:1; }
const USE_LOCAL = QS.get("local")==="1";

/* ---- Room connection: encrypted pub/sub ---- */
class Room {
  // opts: {room, key(b64u), broker, me:{pid, keys}, isHost, hostKeys}
  constructor(o){ Object.assign(this,o); this.base="hurlune1/"+o.room; this.handlers={}; }
  on(ev,fn){ this.handlers[ev]=fn; }
  emit(ev,...a){ if(this.handlers[ev]) this.handlers[ev](...a); }
  async connect(){
    this.T = USE_LOCAL ? new LocalTransport() : new MqttTransport();
    this.T.onStatus(s=>this.emit("status",s));
    this.broker = await this.T.connect(this.broker);
    this.rk = await Crypto.roomKey(this.key);
    this.T.onMessage((t,p)=>this._in(t,p).catch(e=>console.warn("msg",e)));
    if(this.isHost){ this.T.sub(this.base+"/h"); }
    else { this.T.sub(this.base+"/s"); this.T.sub(this.base+"/b"); this.T.sub(this.base+"/p/"+this.me.pid); }
    return this.broker;
  }
  async _in(topic,payload){
    const box = JSON.parse(payload);
    if(topic===this.base+"/s"){ const st=await Crypto.open(this.rk,box); this.hostPub=st.hostPub; this.emit("state",st); }
    else if(topic===this.base+"/b"){ this.emit("bcast", await Crypto.open(this.rk,box)); }
    else if(topic===this.base+"/p/"+this.me.pid){ if(!this.hostPub) return; const k=await Crypto.pairKey(this.me.keys.priv,this.hostPub); this.emit("priv", await Crypto.open(k,box)); }
    else if(topic===this.base+"/h" && this.isHost){
      const outer = await Crypto.open(this.rk, box);       // {from, pub, box}
      const k = await Crypto.pairKey(this.hostKeys.priv, outer.pub);
      const msg = await Crypto.open(k, outer.box);
      this.emit("toHost", outer.from, outer.pub, msg);
    }
  }
  // player -> host
  async send(msg){
    const k = await Crypto.pairKey(this.me.keys.priv, this.hostPub);
    const inner = await Crypto.seal(k,msg);
    const outer = await Crypto.seal(this.rk,{from:this.me.pid,pub:this.me.keys.pub,box:inner});
    this.T.pub(this.base+"/h", JSON.stringify(outer), false, rtQ(msg));
  }
  // host -> all
  async publishState(st){ this.T.pub(this.base+"/s", JSON.stringify(await Crypto.seal(this.rk,st)), true); }
  async broadcast(m){ this.T.pub(this.base+"/b", JSON.stringify(await Crypto.seal(this.rk,m)), false, rtQ(m)); }
  async sendTo(pid,pub,m){ const k=await Crypto.pairKey(this.hostKeys.priv,pub); this.T.pub(this.base+"/p/"+pid, JSON.stringify(await Crypto.seal(k,m)), false, rtQ(m)); }
}
