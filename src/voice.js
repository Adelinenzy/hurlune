/* ===================== Chat vocal : micro -> Opus (WebCodecs) -> relais chiffré -> lecture ===================== */
const VOICE=(function(){
  "use strict";
  const SET=()=>(typeof APP!=="undefined"&&APP.set)||{};
  let testing=false, mon=null;
  let ctx=null, out=null, mic=null, src=null, proc=null, sink=null, enc=null, sending=false, pend=[], seq=0, ts=0, txT=0, sendFn=null, lvl=0, micErr=null;
  const decs={};
  const canSpeak=()=>typeof AudioEncoder!=="undefined"&&typeof AudioData!=="undefined"&&!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
  const canHear=()=>typeof AudioDecoder!=="undefined";
  function ac(){
    if(!ctx){ const C=window.AudioContext||window.webkitAudioContext; try{ ctx=new C({sampleRate:48000,latencyHint:"interactive"}); }catch(e){ ctx=new C(); } out=ctx.createGain(); out.connect(ctx.destination); setVolume(); setSpeaker(SET().spkId); }
    if(ctx.state==="suspended") ctx.resume().catch(()=>{});
    return ctx;
  }
  function setVolume(){ if(!out) return; const s=(typeof APP!=="undefined"&&APP.set)||{}; out.gain.value=s.vmute?0:Math.min(1.6,(s.vol!=null?s.vol:.7)*1.5); }
  async function openMic(){
    if(mic) return true; if(!canSpeak()){ micErr="nomic"; return false; }
    const st=SET(), clean=st.nsup!==false;
    const want={echoCancellation:clean,noiseSuppression:clean,autoGainControl:st.agc!==false,channelCount:1};
    if(st.micId) want.deviceId={exact:st.micId};
    try{ mic=await navigator.mediaDevices.getUserMedia({audio:want}); }
    catch(e){ if(st.micId&&e&&e.name==="OverconstrainedError"){ delete want.deviceId; try{ mic=await navigator.mediaDevices.getUserMedia({audio:want}); }catch(e2){ e=e2; } } if(!mic){
      mic=null; micErr=e&&e.name==="NotAllowedError"?"denied":"nomic"; return false; } }
    micErr=null; const c=ac();
    src=c.createMediaStreamSource(mic); proc=c.createScriptProcessor(2048,1,1); sink=c.createGain(); sink.gain.value=0;
    proc.onaudioprocess=e=>{
      const inp=e.inputBuffer.getChannelData(0); const g=SET().micGain!=null?SET().micGain:1; const data=new Float32Array(inp.length); let s=0;
      for(let i=0;i<inp.length;i++){ const v=Math.max(-1,Math.min(1,inp[i]*g)); data[i]=v; if((i&3)===0) s+=v*v; } lvl=lvl*.6+Math.sqrt(s/(inp.length/4))*.4;
      if(mon){ const ob=e.outputBuffer.getChannelData(0); ob.set(data); }
      if(!sending||!enc||enc.state!=="configured") return;
      try{ const ad=new AudioData({format:"f32-planar",sampleRate:c.sampleRate,numberOfFrames:data.length,numberOfChannels:1,timestamp:ts,data}); ts+=Math.round(data.length/c.sampleRate*1e6); enc.encode(ad); ad.close(); }catch(err){ console.warn("enc",err); }
    };
    src.connect(proc); proc.connect(sink); sink.connect(c.destination);
    return true;
  }
  function setSpeaker(id){ if(ctx&&ctx.setSinkId) ctx.setSinkId(id||"").catch(()=>{}); }
  async function devices(){ try{ const d=await navigator.mediaDevices.enumerateDevices(); return {mics:d.filter(x=>x.kind==="audioinput"),spks:d.filter(x=>x.kind==="audiooutput"),sinkOk:!!(window.AudioContext&&AudioContext.prototype.setSinkId)}; }catch(e){ return {mics:[],spks:[],sinkOk:false}; } }
  async function test(on,hear){ // essai du micro depuis les paramètres
    testing=!!on;
    if(on){ const ok=await openMic(); if(!ok) return false; if(hear&&!mon){ mon=ctx.createGain(); mon.gain.value=1; proc.disconnect(); proc.connect(mon); mon.connect(out); } if(!hear&&mon){ try{ proc.disconnect(); mon.disconnect(); }catch(e){} mon=null; proc.connect(sink); } return true; }
    if(mon){ try{ proc.disconnect(); mon.disconnect(); }catch(e){} mon=null; if(proc) proc.connect(sink); }
    if(!sending&&!(typeof keepMic==="function"&&keepMic())) closeMic(); return true;
  }
  async function reopen(){ const was=!!mic; if(!was) return; const tx=sending, fn=sendFn, hear=!!mon; if(tx) stopTx(); closeMic(); await openMic(); if(testing) await test(true,hear); if(tx&&fn) startTx(fn); }
  function closeMic(){ stopTx(); if(mon){ try{ mon.disconnect(); }catch(e){} mon=null; } if(mic){ mic.getTracks().forEach(t=>t.stop()); mic=null; } try{ src&&src.disconnect(); proc&&proc.disconnect(); sink&&sink.disconnect(); }catch(e){} src=proc=sink=null; lvl=0; }
  function flushPend(){ if(pend.length&&sendFn) sendFn(seq++,pend.splice(0)); }
  function startTx(fn){
    if(sending||!mic) return false; sendFn=fn; seq=0; ts=0; pend=[];
    try{
      enc=new AudioEncoder({output:ch=>{ const b=new Uint8Array(ch.byteLength); ch.copyTo(b); pend.push(b64(b)); },error:e=>console.warn("opus",e)});
      enc.configure({codec:"opus",sampleRate:ctx.sampleRate,numberOfChannels:1,bitrate:24000});
    }catch(e){ console.warn(e); enc=null; return false; }
    sending=true; txT=setInterval(flushPend,240); return true;
  }
  function stopTx(){
    if(!sending) return; sending=false; clearInterval(txT);
    const e=enc; enc=null; if(e){ e.flush().then(()=>{ flushPend(); e.close(); }).catch(()=>{ flushPend(); }); } else flushPend();
  }
  // ---- réception ----
  function rx(a,s,d){
    if(!canHear()||!Array.isArray(d)) return; const c=ac();
    let S=decs[a];
    if(!S||Date.now()-S.last>3000||s<=S.s-50){
      if(S&&S.dec.state!=="closed") try{ S.dec.close(); }catch(e){}
      S=decs[a]={t:0,play:0,last:0,s:-1};
      S.dec=new AudioDecoder({output:ad=>play(S,ad),error:e=>console.warn("dec",e)});
      S.dec.configure({codec:"opus",sampleRate:48000,numberOfChannels:1});
    }
    S.last=Date.now(); S.s=s;
    for(const x of d){ try{ S.dec.decode(new EncodedAudioChunk({type:"key",timestamp:S.t,data:ub64(x)})); }catch(e){} S.t+=20000; }
  }
  function play(S,ad){
    const n=ad.numberOfFrames, sr=ad.sampleRate; const f=new Float32Array(n);
    try{ ad.copyTo(f,{planeIndex:0,format:"f32-planar"}); }catch(e){ try{ ad.copyTo(f,{planeIndex:0}); }catch(_){} } ad.close();
    const buf=ctx.createBuffer(1,n,sr); buf.copyToChannel(f,0);
    const now=ctx.currentTime; if(S.play<now+.04) S.play=now+.28; // petit tampon anti-saccades
    const b=ctx.createBufferSource(); b.buffer=buf; b.connect(out); b.start(S.play); S.play+=n/sr;
  }
  // ---- pour la retranscription (hôte) : paquets Opus -> WAV 16 kHz ----
  async function toWav(pk){
    if(!canHear()) return null; const parts=[]; let sr=48000;
    const dec=new AudioDecoder({output:ad=>{ sr=ad.sampleRate; const f=new Float32Array(ad.numberOfFrames); try{ ad.copyTo(f,{planeIndex:0,format:"f32-planar"}); }catch(e){ try{ ad.copyTo(f,{planeIndex:0}); }catch(_){} } ad.close(); parts.push(f); },error:e=>console.warn(e)});
    dec.configure({codec:"opus",sampleRate:48000,numberOfChannels:1}); let t=0;
    for(const x of pk){ try{ dec.decode(new EncodedAudioChunk({type:"key",timestamp:t,data:ub64(x)})); }catch(e){} t+=20000; }
    await dec.flush(); dec.close();
    let n=0; for(const p of parts) n+=p.length; const all=new Float32Array(n); let o=0; for(const p of parts){ all.set(p,o); o+=p.length; }
    let e=0; for(let i=0;i<all.length;i+=8) e+=all[i]*all[i]; const rms=Math.sqrt(e/Math.max(1,all.length/8));
    if(all.length<sr*.6||rms<.004) return null; // silence : rien à retranscrire
    const R=16000, k=sr/R, m=Math.floor(all.length/k), pcm=new Int16Array(m);
    for(let i=0;i<m;i++){ let s=0; const a=Math.floor(i*k), b=Math.min(all.length,Math.floor((i+1)*k)); for(let j=a;j<b;j++) s+=all[j]; s/=Math.max(1,b-a); pcm[i]=Math.max(-32768,Math.min(32767,s*32767)); }
    const buf=new ArrayBuffer(44+pcm.length*2), v=new DataView(buf); const w=(o,s)=>{ for(let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); };
    w(0,"RIFF"); v.setUint32(4,36+pcm.length*2,true); w(8,"WAVE"); w(12,"fmt "); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
    v.setUint32(24,R,true); v.setUint32(28,R*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true); w(36,"data"); v.setUint32(40,pcm.length*2,true);
    new Int16Array(buf,44).set(pcm); return new Blob([buf],{type:"audio/wav"});
  }
  return { canSpeak, canHear, openMic, closeMic, devices, test, reopen, setSpeaker, get testing(){ return testing; }, startTx, stopTx, rx, toWav, setVolume, unlock:()=>{ try{ ac(); }catch(e){} },
    get sending(){ return sending; }, get micOn(){ return !!mic; }, get micErr(){ return micErr; }, level:()=>lvl };
})();
