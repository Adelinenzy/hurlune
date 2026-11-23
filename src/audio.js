/* ===================== AUDIO (procedural, with reverb & ambiences) ===================== */
const AUD = (function(){
  let c=null, master, comp, verb, verbIn, dry, amb={}, curMood=null, hbTimer=null, evTimer=null, started=false;
  const vol=()=>{ const v=(APP&&APP.set&&APP.set.vol!=null)?APP.set.vol:.8; return (APP&&APP.set&&APP.set.sound===false)?0:v; };
  function ctx(){
    if(c) return c;
    try{ c=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; }
    master=c.createGain(); master.gain.value=vol();
    comp=c.createDynamicsCompressor(); comp.threshold.value=-18; comp.ratio.value=3;
    master.connect(comp).connect(c.destination);
    // reverb: generated impulse response
    verb=c.createConvolver(); const len=c.sampleRate*3.2, ir=c.createBuffer(2,len,c.sampleRate);
    for(let ch=0;ch<2;ch++){ const d=ir.getChannelData(ch); for(let i=0;i<len;i++){ const tt=i/len; d[i]=(Math.random()*2-1)*Math.pow(1-tt,3.2)*(i<c.sampleRate*.01?i/(c.sampleRate*.01):1); } }
    verb.buffer=ir; verbIn=c.createGain(); verbIn.gain.value=.55; verbIn.connect(verb); const vOut=c.createGain(); vOut.gain.value=.5; verb.connect(vOut).connect(master);
    dry=c.createGain(); dry.connect(master);
    return c;
  }
  function out(node,wet=.35){ const g1=c.createGain(); g1.gain.value=1-wet*.4; const g2=c.createGain(); g2.gain.value=wet; node.connect(g1).connect(dry); node.connect(g2).connect(verbIn); }
  function noiseBuf(sec=2,color="white"){ const b=c.createBuffer(1,c.sampleRate*sec,c.sampleRate), d=b.getChannelData(0); let l=0;
    for(let i=0;i<d.length;i++){ const w=Math.random()*2-1; if(color==="brown"){ l=(l+.02*w)/1.02; d[i]=l*3.5; } else if(color==="pink"){ l=.97*l+.03*w; d[i]=(l*3+w*.15); } else d[i]=w; } return b; }
  function env(g,T,a,peak,d,sus=0){ g.gain.cancelScheduledValues(T); g.gain.setValueAtTime(.0001,T); g.gain.exponentialRampToValueAtTime(peak,T+a); g.gain.exponentialRampToValueAtTime(Math.max(sus,.0001),T+a+d); }
  // FM bell
  function bell(T,f,{dur=3,v=.25,ratio=1.4,idx=3,wet=.6}={}){
    const car=c.createOscillator(), mod=c.createOscillator(), mg=c.createGain(), g=c.createGain();
    car.frequency.value=f; mod.frequency.value=f*ratio; mg.gain.setValueAtTime(f*idx,T); mg.gain.exponentialRampToValueAtTime(f*.05,T+dur);
    mod.connect(mg).connect(car.frequency); car.connect(g); env(g,T,.005,v,dur); out(g,wet); car.start(T); mod.start(T); car.stop(T+dur+.1); mod.stop(T+dur+.1);
  }
  function pluck(T,f,{v=.2,dur=.6,type="triangle",wet=.3,cut=2500}={}){ const o=c.createOscillator(), g=c.createGain(), fl=c.createBiquadFilter(); o.type=type; o.frequency.value=f; fl.type="lowpass"; fl.frequency.setValueAtTime(cut,T); fl.frequency.exponentialRampToValueAtTime(300,T+dur); o.connect(fl).connect(g); env(g,T,.004,v,dur); out(g,wet); o.start(T); o.stop(T+dur+.05); }
  function noiseHit(T,{f=1000,q=1,v=.3,dur=.08,type="bandpass",wet=.2}={}){ const s=c.createBufferSource(); s.buffer=noiseBuf(Math.max(.2,dur+.05)); const fl=c.createBiquadFilter(); fl.type=type; fl.frequency.value=f; fl.Q.value=q; const g=c.createGain(); s.connect(fl).connect(g); env(g,T,.002,v,dur); out(g,wet); s.start(T); s.stop(T+dur+.05); }
  function howl(T,{base=330,v=.22,dur=3.2,wet=.8}={}){
    for(const [det,vv] of [[0,v],[6,v*.5],[-4,v*.35]]){
      const o=c.createOscillator(); o.type="sawtooth"; const lfo=c.createOscillator(), lg=c.createGain(); lfo.frequency.value=5.2+Math.random(); lg.gain.value=7;
      lfo.connect(lg).connect(o.frequency);
      const f1=c.createBiquadFilter(); f1.type="bandpass"; f1.frequency.value=500; f1.Q.value=6; const f2=c.createBiquadFilter(); f2.type="bandpass"; f2.frequency.value=900; f2.Q.value=8;
      const g=c.createGain(), mix=c.createGain(); mix.gain.value=1;
      const b=base+det;
      o.frequency.setValueAtTime(b*.85,T); o.frequency.exponentialRampToValueAtTime(b*1.75,T+dur*.28); o.frequency.setValueAtTime(b*1.75,T+dur*.55); o.frequency.exponentialRampToValueAtTime(b*1.25,T+dur);
      f1.frequency.setValueAtTime(400,T); f1.frequency.linearRampToValueAtTime(650,T+dur*.3);
      o.connect(f1).connect(mix); o.connect(f2).connect(mix); mix.connect(g);
      g.gain.setValueAtTime(.0001,T); g.gain.exponentialRampToValueAtTime(vv,T+dur*.22); g.gain.setValueAtTime(vv,T+dur*.6); g.gain.exponentialRampToValueAtTime(.0001,T+dur);
      out(g,wet); o.start(T); lfo.start(T); o.stop(T+dur+.1); lfo.stop(T+dur+.1);
    }
  }
  function thunder(T){
    const s=c.createBufferSource(); s.buffer=noiseBuf(4.5,"brown"); const f=c.createBiquadFilter(); f.type="lowpass"; f.frequency.setValueAtTime(1800,T); f.frequency.exponentialRampToValueAtTime(140,T+3.5);
    const g=c.createGain(); g.gain.setValueAtTime(.0001,T); g.gain.exponentialRampToValueAtTime(1.2,T+.03); g.gain.exponentialRampToValueAtTime(.5,T+.25); g.gain.linearRampToValueAtTime(.7,T+.6); g.gain.exponentialRampToValueAtTime(.0001,T+4.2);
    s.connect(f).connect(g); out(g,.5); s.start(T); s.stop(T+4.4);
    noiseHit(T,{f:3000,q:.5,v:.5,dur:.15,type:"highpass",wet:.6});
    const o=c.createOscillator(); o.type="sine"; o.frequency.setValueAtTime(70,T); o.frequency.exponentialRampToValueAtTime(30,T+1.5); const og=c.createGain(); o.connect(og); env(og,T,.01,.6,1.6); out(og,.3); o.start(T); o.stop(T+1.7);
  }
  function heartbeat(T,v=.55){ for(const [dt,f,vv] of [[0,62,v],[.24,52,v*.75]]){ const o=c.createOscillator(); o.type="sine"; o.frequency.setValueAtTime(f*1.6,T+dt); o.frequency.exponentialRampToValueAtTime(f,T+dt+.08); const g=c.createGain(); o.connect(g); env(g,T+dt,.008,vv,.28); out(g,.15); o.start(T+dt); o.stop(T+dt+.35); } }
  function chord(T,fs,{type="sawtooth",v=.08,dur=1.2,cut=1800,wet=.5,stagger=0}={}){ fs.forEach((f,i)=>{ const o=c.createOscillator(); o.type=type; o.frequency.value=f; const fl=c.createBiquadFilter(); fl.type="lowpass"; fl.frequency.setValueAtTime(cut*.4,T); fl.frequency.linearRampToValueAtTime(cut,T+.15); const g=c.createGain(); o.connect(fl).connect(g); const t0=T+i*stagger; g.gain.setValueAtTime(.0001,t0); g.gain.exponentialRampToValueAtTime(v,t0+.06); g.gain.setValueAtTime(v,t0+dur*.6); g.gain.exponentialRampToValueAtTime(.0001,t0+dur); out(g,wet); o.start(t0); o.stop(t0+dur+.1); }); }

  /* ---- ambience beds ---- */
  function makeBeds(){
    if(amb.ready) return; amb.ready=true;
    const loop=(buf)=>{ const s=c.createBufferSource(); s.buffer=buf; s.loop=true; return s; };
    // wind
    { const s=loop(noiseBuf(6,"pink")), f=c.createBiquadFilter(); f.type="bandpass"; f.frequency.value=380; f.Q.value=.7; const g=c.createGain(); g.gain.value=0;
      const lfo=c.createOscillator(), lg=c.createGain(); lfo.frequency.value=.07; lg.gain.value=260; lfo.connect(lg).connect(f.frequency);
      s.connect(f).connect(g); out(g,.4); s.start(); lfo.start(); amb.wind=g; }
    // night drone
    { const g=c.createGain(); g.gain.value=0; const f=c.createBiquadFilter(); f.type="lowpass"; f.frequency.value=260; f.Q.value=2;
      const lfo=c.createOscillator(), lg=c.createGain(); lfo.frequency.value=.05; lg.gain.value=120; lfo.connect(lg).connect(f.frequency); lfo.start();
      for(const fr of [55,55.4,82.4,110.3,130.8]){ const o=c.createOscillator(); o.type="sawtooth"; o.frequency.value=fr; o.connect(f); o.start(); }
      f.connect(g); out(g,.7); amb.drone=g; }
    // fire crackle bed
    { const s=loop(noiseBuf(4,"brown")), f=c.createBiquadFilter(); f.type="lowpass"; f.frequency.value=500; const g=c.createGain(); g.gain.value=0; s.connect(f).connect(g); out(g,.2); s.start(); amb.fire=g; }
    // day birds handled by events
    evTimer=setInterval(events,350);
  }
  function events(){
    if(!c||!curMood) return; const T=c.currentTime+.02; const m=curMood;
    if(Math.random()<.25) noiseHit(T,{f:1800+Math.random()*2500,q:4,v:.05+Math.random()*.08,dur:.02+Math.random()*.03,wet:.1}); // crackle
    if(m==="day"&&Math.random()<.06){ const b=2400+Math.random()*1500; for(let i=0;i<3+Math.floor(Math.random()*4);i++){ const o=c.createOscillator(), g=c.createGain(); o.type="sine"; const t0=T+i*.11; o.frequency.setValueAtTime(b,t0); o.frequency.exponentialRampToValueAtTime(b*(1.2+Math.random()*.4),t0+.07); o.connect(g); env(g,t0,.005,.035,.09); out(g,.35); o.start(t0); o.stop(t0+.12); } }
    if((m==="night"||m==="wolves")&&Math.random()<.012) howl(T,{base:240+Math.random()*120,v:.07,dur:3+Math.random()*1.5,wet:.95});
    if(m==="night"&&Math.random()<.02){ for(const [dt,f] of [[0,390],[.45,330],[.62,330]]){ const o=c.createOscillator(), g=c.createGain(); o.type="sine"; o.frequency.setValueAtTime(f,T+dt); o.frequency.exponentialRampToValueAtTime(f*.92,T+dt+.25); o.connect(g); env(g,T+dt,.04,.05,.32); out(g,.8); o.start(T+dt); o.stop(T+dt+.4); } }
    if(m==="dusk"&&Math.random()<.05){ for(let i=0;i<6;i++){ noiseHit(T+i*.045,{f:4800,q:12,v:.02,dur:.03,wet:.2}); } }
  }
  function setMood(m){
    const C=ctx(); if(!C||!started) { curMood=m; return; } makeBeds(); curMood=m;
    const T=C.currentTime, ramp=(g,v)=>{ g.gain.cancelScheduledValues(T); g.gain.setValueAtTime(g.gain.value,T); g.gain.linearRampToValueAtTime(v,T+2.5); };
    const L={day:[.10,0,.10],dusk:[.10,.03,.14],night:[.2,.09,.12],wolves:[.26,.15,.08]}[m]||[.1,0,.1];
    ramp(amb.wind,L[0]); ramp(amb.drone,L[1]); ramp(amb.fire,L[2]);
    clearInterval(hbTimer); hbTimer=null;
    if(m==="wolves"){ hbTimer=setInterval(()=>{ if(c&&vol()>0) heartbeat(c.currentTime+.01,.5); },880); }
  }
  function unlock(){ const C=ctx(); if(!C) return; if(C.state==="suspended") C.resume(); if(!started){ started=true; if(curMood) setMood(curMood); } }
  document.addEventListener("pointerdown",unlock); document.addEventListener("keydown",unlock);
  function setVolume(){ if(master) master.gain.value=vol(); }

  function play(kind){
    const C=ctx(); if(!C||vol()<=0) return; if(C.state==="suspended") return; const T=C.currentTime+.01;
    switch(kind){
      case "tick": { const tock=(Math.round(T*2)%2)===0; noiseHit(T,{f:tock?1900:2600,q:8,v:.18,dur:.035,wet:.15}); pluck(T,tock?880:1175,{v:.05,dur:.08,type:"sine",wet:.1}); break; }
      case "warn": bell(T,659,{dur:1.6,v:.16,ratio:2.01,idx:2.2}); bell(T+.22,523,{dur:2,v:.13,ratio:2.01,idx:2}); break;
      case "step": [523.3,659.3,784,1046.5].forEach((f,i)=>bell(T+i*.09,f,{dur:1.4,v:.06,ratio:3.5,idx:1.2,wet:.75})); break;
      case "night": howl(T,{base:300,v:.2,dur:3.6}); chord(T+.2,[55,82.4,110,130.8],{type:"sawtooth",v:.05,dur:4,cut:600,wet:.8}); bell(T,65.4,{dur:4.5,v:.25,ratio:1.41,idx:2,wet:.8}); break;
      case "day": [0,1,2].forEach(i=>bell(T+i*.9,196,{dur:3.5,v:.22,ratio:2.76,idx:2.5,wet:.75})); [392,494,587.3,784].forEach((f,i)=>pluck(T+.2+i*.12,f,{v:.08,dur:.9,wet:.5})); break;
      case "vote": noiseHit(T,{f:700,q:3,v:.25,dur:.06,wet:.25}); pluck(T,196,{v:.12,dur:.18,type:"sine",wet:.2}); break;
      case "flip": { const s=c.createBufferSource(); s.buffer=noiseBuf(.6); const f=c.createBiquadFilter(); f.type="bandpass"; f.Q.value=1.2; f.frequency.setValueAtTime(400,T); f.frequency.exponentialRampToValueAtTime(5000,T+.4); const g=c.createGain(); s.connect(f).connect(g); env(g,T,.12,.25,.35); out(g,.4); s.start(T); s.stop(T+.6);
        [784,988,1175,1568,1976].forEach((fr,i)=>bell(T+.35+i*.07,fr,{dur:1.2,v:.06,ratio:3,idx:1,wet:.7})); break; }
      case "start": chord(T,[196,293.7],{type:"sawtooth",v:.07,dur:.7,cut:1600,wet:.5}); chord(T+.55,[220,329.6],{type:"sawtooth",v:.07,dur:.7,cut:1700,wet:.5}); chord(T+1.1,[261.6,392,523.3],{type:"sawtooth",v:.08,dur:1.6,cut:2200,wet:.6}); break;
      case "win": [[261.6,329.6,392],[293.7,370,440],[329.6,415.3,493.9],[392,493.9,587.3,784]].forEach((ch,i)=>chord(T+i*.32,ch,{type:"sawtooth",v:.06,dur:i===3?2.2:.5,cut:2600,wet:.55})); break;
      case "lose": [[220,261.6,329.6],[207.7,246.9,311.1],[196,233.1,293.7]].forEach((ch,i)=>chord(T+i*.6,ch,{type:"triangle",v:.08,dur:i===2?2.4:.8,cut:1200,wet:.7})); break;
      case "thunder": thunder(T); break;
      case "howl": howl(T); break;
      case "mention": pluck(T,1046.5,{v:.12,dur:.4,type:"sine"}); pluck(T+.09,1568,{v:.1,dur:.5,type:"sine"}); break;
      case "ping": bell(T,880,{dur:1,v:.08,ratio:3,idx:1}); break;
      case "send": pluck(T,660,{v:.05,dur:.12,type:"sine",wet:.05}); break;
    }
  }
  return {play,setMood,setVolume,unlock};
})();
