/* ===================== R4 : rendu principal ===================== */
(function(){
  "use strict";
  const {M,sub,add,scl,dot,cross,nrm,lerp,lerp3,clamp,smooth,hash}=R4;
  const QUAL={ low:{dpr:.8,msaa:0,shadow:0,fireSh:0,grass:7000,bloom:1}, med:{dpr:1,msaa:4,shadow:1024,fireSh:0,grass:26000,bloom:1}, high:{dpr:1.6,msaa:4,shadow:2048,fireSh:384,grass:55000,bloom:1} };
  const MOOD_TOD={day:.36,dusk:.742,night:.9,wolves:.93};
  const K=(a,b,t)=>lerp3(a,b,clamp(t,0,1));

  function skyState(e,wolves,snow){
    // couleurs en linéaire (HDR)
    const DAY={zen:[.13,.32,.78],hor:[.55,.7,.92],sun:[3.4,3.15,2.8],sky:[.3,.38,.55],gnd:[.16,.14,.11],fog:[.55,.66,.85],cl:[.85,.87,.92],lit:[1.15,1.1,1.02],exp:.62};
    const GOLD={zen:[.16,.24,.52],hor:[1.05,.6,.32],sun:[2.8,1.65,.8],sky:[.25,.24,.34],gnd:[.14,.09,.06],fog:[.7,.48,.38],cl:[.42,.33,.42],lit:[1.5,.85,.45],exp:.78};
    const SET={zen:[.09,.11,.3],hor:[1.0,.36,.14],sun:[1.8,.62,.2],sky:[.13,.12,.22],gnd:[.07,.05,.05],fog:[.5,.26,.24],cl:[.25,.16,.25],lit:[1.3,.45,.2],exp:1.0};
    const BLUE={zen:[.025,.04,.13],hor:[.22,.14,.3],sun:[0,0,0],sky:[.05,.055,.11],gnd:[.015,.015,.025],fog:[.1,.085,.16],cl:[.07,.07,.12],lit:[.3,.16,.26],exp:1.45};
    const NIGHT={zen:[.003,.006,.018],hor:[.016,.024,.055],sun:[0,0,0],sky:[.012,.016,.032],gnd:[.004,.004,.008],fog:[.012,.016,.034],cl:[.018,.022,.036],lit:[.05,.06,.09],exp:1.9};
    let A,B,t;
    if(e>.3){ A=DAY;B=DAY;t=0; } else if(e>.08){ A=GOLD;B=DAY;t=(e-.08)/.22; } else if(e>0){ A=SET;B=GOLD;t=e/.08; } else if(e>-.12){ A=BLUE;B=SET;t=(e+.12)/.12; } else if(e>-.3){ A=NIGHT;B=BLUE;t=(e+.3)/.18; } else { A=NIGHT;B=NIGHT;t=0; }
    const s=smooth(0,1,t), o={};
    for(const k in DAY){ o[k]=Array.isArray(DAY[k])?K(A[k],B[k],s):lerp(A[k],B[k],s); }
    o.stars=smooth(.02,-.22,e); o.night=smooth(.0,-.25,e);
    o.fogD=lerp(.0045,.03,o.night); o.fogH=lerp(.05,.32,o.night);
    o.cloud=lerp(.75,.45,o.night);
    o.glow=smooth(-.08,.05,e);
    if(snow){ o.gnd=lerp3(o.gnd,o.sky,.6); o.fog=lerp3(o.fog,[o.fog[1]*1.05,o.fog[1]*1.08,o.fog[2]*1.12],.5); }
    if(wolves){ o.hor=lerp3(o.hor,[.12,.012,.016],.7); o.fog=lerp3(o.fog,[.05,.006,.008],.75); o.cl=lerp3(o.cl,[.06,.01,.012],.6); o.fogD*=1.35; o.sky=lerp3(o.sky,[.03,.006,.008],.6); }
    return o;
  }

  R4.create=function(canvas,opts={}){
    const gl=canvas.getContext("webgl2",{antialias:false,alpha:false,depth:true,powerPreference:"high-performance",preserveDrawingBuffer:false});
    if(!gl) return null;
    const hasFloat=!!gl.getExtension("EXT_color_buffer_float"); gl.getExtension("OES_texture_float_linear");
    const P={}; try{
      P.std=R4.compile(gl,R4.STD_VS,R4.STD_FS); P.depth=R4.compile(gl,R4.STD_VS,R4.DEPTH_FS); P.skin=R4.compile(gl,R4.SKIN_VS,R4.STD_FS); P.kit=R4.compile(gl,R4.KIT_VS,R4.STD_FS); P.kitD=R4.compile(gl,R4.KIT_VS,R4.DEPTH_FS); P.skinD=R4.compile(gl,R4.SKIN_VS,R4.DEPTH_FS); P.grass=R4.compile(gl,R4.GRASS_VS,R4.GRASS_FS);
      P.sky=R4.compile(gl,R4.SKY_VS,R4.SKY_FS); P.part=R4.compile(gl,R4.PART_VS,R4.PART_FS);
      P.bright=R4.compile(gl,R4.QUAD_VS,R4.BRIGHT_FS); P.down=R4.compile(gl,R4.QUAD_VS,R4.DOWN_FS); P.up=R4.compile(gl,R4.QUAD_VS,R4.UP_FS); P.comp=R4.compile(gl,R4.QUAD_VS,R4.COMP_FS);
    }catch(e){ console.warn("R4 shaders",e); return null; }
    const preview=!!opts.preview;
    let qk=QUAL[opts.quality]?opts.quality:"med"; let q=Object.assign({},QUAL[qk]); if(!hasFloat){ q.msaa=0; }
    let theme=opts.theme||"forest"; let world=null, grass=null; const logM=R4.buildLog(gl), graveM=R4.buildGrave(gl), ringM=R4.buildRing(gl), eyesM=R4.buildEyes(gl);
    // quad plein écran
    const quad=gl.createVertexArray(); gl.bindVertexArray(quad); const qb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,qb); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0); gl.bindVertexArray(null);
    // particules
    const pvao=gl.createVertexArray(); gl.bindVertexArray(pvao); const pq=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,pq); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-.5,-.5,.5,-.5,-.5,.5,.5,.5]),gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    const pinst=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,pinst); for(let i=0;i<3;i++){ gl.enableVertexAttribArray(1+i); gl.vertexAttribPointer(1+i,4,gl.FLOAT,false,48,i*16); gl.vertexAttribDivisor(1+i,1); } gl.bindVertexArray(null);

    /* ---------- cibles de rendu ---------- */
    let RT=null;
    function tex(w,h,fmt,f){ const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t); const F=fmt==="f"?[gl.RGBA16F,gl.RGBA,gl.HALF_FLOAT]:[gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE];
      gl.texImage2D(gl.TEXTURE_2D,0,F[0],w,h,0,F[1],F[2],null); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,f||gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,f||gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); return t; }
    function fboTex(t){ const f=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,f); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0); return f; }
    function makeRT(w,h){
      if(RT){ for(const t of RT.texs) gl.deleteTexture(t); for(const f of RT.fbos) gl.deleteFramebuffer(f); for(const r of RT.rbs) gl.deleteRenderbuffer(r); }
      const fmt=hasFloat?"f":"b"; const o={w,h,texs:[],fbos:[],rbs:[]};
      o.scene=tex(w,h,fmt); o.texs.push(o.scene); o.sceneF=fboTex(o.scene); o.fbos.push(o.sceneF);
      const dr=gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER,dr); gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,dr); o.rbs.push(dr);
      if(q.msaa){ const s=Math.min(q.msaa,gl.getParameter(gl.MAX_SAMPLES)); o.ms=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,o.ms);
        const c=gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER,c); gl.renderbufferStorageMultisample(gl.RENDERBUFFER,s,fmt==="f"?gl.RGBA16F:gl.RGBA8,w,h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,c);
        const d=gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER,d); gl.renderbufferStorageMultisample(gl.RENDERBUFFER,s,gl.DEPTH_COMPONENT24,w,h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,d);
        o.rbs.push(c,d); o.fbos.push(o.ms); if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){ o.ms=null; } }
      o.lv=[]; let lw=w>>1,lh=h>>1; for(let i=0;i<5;i++){ lw=Math.max(1,lw); lh=Math.max(1,lh); const a=tex(lw,lh,fmt), b=tex(lw,lh,fmt); o.texs.push(a,b); const fa=fboTex(a), fb=fboTex(b); o.fbos.push(fa,fb); o.lv.push({w:lw,h:lh,a,b,fa,fb}); lw>>=1; lh>>=1; }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null); RT=o; }
    // ombres du soleil/lune
    let SH=null;
    function makeShadow(size){ if(SH){ gl.deleteTexture(SH.t); gl.deleteFramebuffer(SH.f); } const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,size,size,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      const f=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,f); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,t,0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null); SH={t,f,size}; }
    // ombres du feu (cube de distances)
    let FS=null;
    function makeFireSh(size){ if(FS){ gl.deleteTexture(FS.t); FS.f.forEach(f=>gl.deleteFramebuffer(f)); gl.deleteRenderbuffer(FS.d); }
      const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_CUBE_MAP,t);
      for(let i=0;i<6;i++) gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X+i,0,hasFloat?gl.RGBA16F:gl.RGBA8,size,size,0,gl.RGBA,hasFloat?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      const d=gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER,d); gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,size,size);
      const f=[]; for(let i=0;i<6;i++){ const fb=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fb); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_CUBE_MAP_POSITIVE_X+i,t,0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,d); f.push(fb); }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null); FS={t,f,d,size}; }
    function applyQuality(){ makeShadow(q.shadow||16); makeFireSh(q.fireSh||8); RT=RT&&null; lastW=0; if(world&&!preview){ if(grass){ gl.deleteVertexArray(grass.vao); grass.b.forEach(b=>gl.deleteBuffer(b)); } grass=R4.buildGrass(gl,q.grass,theme); } }
    let lastW=0,lastH=0;

    /* ---------- état ---------- */
    let chars={}, order=[], me=null, votes={}, mood=opts.mood||"dusk", tod=MOOD_TOD[mood], todT=tod, paused=false, onPick=null, canPick=()=>false, hover=null;
    let camYaw=0, drag=0, dragging=false, dragX=0, moved=0, downId=null, zoom=1, T0=performance.now(), last=0, cine=0;
    const parts=[]; let pdata=new Float32Array(4096*12);
    function kitOK(){ return opts.real!==false&&qk!=="low"; }
    function loadWorld(th){ theme=th; if(world){ R4.free(gl,world.far); R4.free(gl,world.near); R4.freeKit(gl,world.kit); }
      const useKit=kitOK()&&!!R4.KITS.nature; world=R4.buildWorld(gl,th,useKit);
      if(useKit) world.kit=R4.buildKit(gl,R4.kitPlacements(th,world.hgt),th==="winter");
      if(kitOK()){ const need=["nature"].concat(th==="village"?["village"]:[]).filter(k=>!R4.KITS[k]);
        if(need.length) Promise.all(need.map(k=>R4.loadKit(k))).then(()=>{ if(theme===th&&world) loadWorld(th); }).catch(e=>console.warn(e)); }
      applyQuality(); }
    function drawKit(p,shadow){ if(!world||!world.kit) return; const u=p.u;
      for(const g of world.kit){ gl.uniform1f(u.uMat,g.cut?13:12);
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D,g.alb); gl.activeTexture(gl.TEXTURE0);
        if(shadow){ gl.uniform1f(u.uCut,g.cut); }
        else { if(g.nrm){ gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D,g.nrm); gl.activeTexture(gl.TEXTURE0); } gl.uniform1f(u.uNrmOn,g.nrm?1:0);
          gl.uniform3fv(u.uTint,g.tint); gl.uniform1f(u.uVcol,g.vc); gl.uniform1f(u.uRock,g.rock); gl.uniform1f(u.uHi,0); gl.uniform3fv(u.uHiCol,[0,0,0]); gl.uniform1f(u.uAlpha,1); gl.uniform1f(u.uWin,S.win); gl.uniform1f(u.uEmisK,g.win||0); }
        gl.bindVertexArray(g.vao); gl.drawElements(gl.TRIANGLES,g.n,gl.UNSIGNED_INT,0); } }
    if(!preview) loadWorld(theme); else { world=null; makeShadow(q.shadow||1024); makeFireSh(8); }

    /* ---------- personnages ---------- */
    function seat(i,n){ const R=clamp(n*.36+1.35,2.6,5.6); const a=i/n*Math.PI*2; return {x:Math.sin(a)*R,z:Math.cos(a)*R,a,R}; }
    function setPlayers(list,meId){
      me=meId; const n=Math.max(list.length,1); const seen=new Set();
      list.forEach((p,i)=>{ seen.add(p.id); let c=chars[p.id]; const key=JSON.stringify(R4.avNorm(p.av));
        if(!c||c.key!==key){ if(c) R4.freeChar(gl,c.m); c=chars[p.id]=Object.assign(c||{id:p.id,pose:{},die:0,dying:0,talk:0,blink:2+Math.random()*3,lookT:0,look:[0,.8,0],seed:Math.random()*10,warm:Math.random()<.5,init:true},{key,m:R4.buildChar(gl,p.av)});
          useReal(c,p.av); }
        const s=seat(i,n); if(preview){ s.x=0; s.z=0; } c.tx=s.x; c.tz=s.z; c.sa=s.a; c.R=s.R; if(c.init){ c.x=s.x; c.z=s.z; c.init=false; if(p.alive===false){ c.die=1; } }
        if(c.alive!==false&&p.alive===false&&!c.init) c.dying=0.0001;
        c.alive=p.alive!==false; c.sel=!!p.sel; c.click=!!p.click; c.sleep=!!p.sleep; c.inact=!!p.inact; c.wolf=!!p.wolf; c.point=p.point||null; });
      for(const id of Object.keys(chars)) if(!seen.has(id)){ R4.freeChar(gl,chars[id].m); delete chars[id]; }
      order=list.map(p=>p.id);
    }
    function headPos(c){ if(c.rig&&c.headTop) return c.headTop; return c.W?M.xf(c.W.head,[0,.21,0]):[c.x,1.25,c.z]; }
    function realOK(){ return opts.real!==false&&qk!=="low"; }
    // on garde l'ancien personnage affiché tant que le nouveau (maillage + textures) n'est pas prêt : jamais de figurine provisoire
    function useReal(c,av){ const slug=realOK()?R4.charSlug(R4.avNorm(av)):null; c.slug=slug; if(!slug){ c.rig=null; return; }
      if(c.rig&&c.rig.slug===slug) return;
      const setup=()=>{ if(c.slug!==slug) return; const base=R4.charRig(slug); if(!base){ c.slug=null; return; } const g=R4.charGPU(gl,slug);
        const inst=Object.create(base); inst.mats=new Float32Array(base.n*16); inst.W=[]; c.ready=g.ready;
        g.ready.then(()=>{ if(c.slug!==slug) return; c.rig=inst; if(preview&&onReady) onReady(); }); };
      if(R4.CHARS[slug]) setup(); else R4.loadChar(slug).then(setup).catch(e=>{ console.warn(e); if(c.slug===slug){ c.slug=null; c.rig=null; } }); }
    function poseOf(c,t,dt){
      const T={}; const breath=Math.sin(t*1.7+c.seed)*.025;
      T.spine=[.06+breath,0,0]; T.neck=[0,0,0]; T.head=[0,0,0];
      T.hipL=[-1.5,.06,0]; T.hipR=[-1.5,-.06,0]; T.knL=[1.45,0,0]; T.knR=[1.45,0,0];
      T.shL=[-.42,0,-.1]; T.shR=[-.42,0,.1]; T.elL=[-1.0,0,0]; T.elR=[-1.0,0,0];
      T.px=0; T.py=0; T.pz=0; T.pelvis=[0,0,0];
      if(preview){ T.hipL=[0,0,.03]; T.hipR=[0,0,-.03]; T.knL=[.05,0,0]; T.knR=[.05,0,0]; T.py=.33; T.shL=[.05,0,-.12]; T.shR=[.05,0,.12]; T.elL=[-.25,0,0]; T.elR=[-.25,0,0];
        T.shR=[-.2+Math.sin(t*.9)*.05,0,.15]; T.head=[Math.sin(t*.7)*.06,Math.sin(t*.45)*.25,0];
        if(cheer){ T.shR=[-.3,0,-2.6]; T.elR=[-.5,0,0]; T.shL=[.05,0,-.3]; T.head=[-.1,.12,0]; } }
      // regard
      const hp=[c.x,1.2,c.z]; const L=c.look||[0,.8,0]; const d=sub(L,hp); const f=-c.face; const lx=d[0]*Math.cos(f)+d[2]*Math.sin(f)*-1, lz=d[0]*Math.sin(f)+d[2]*Math.cos(f);
      let yaw=clamp(Math.atan2(lx,lz),-1.1,1.1), pitch=clamp(-Math.atan2(d[1],Math.hypot(lx,lz)),-.5,.6);
      if(!preview){ T.neck=[pitch*.35,yaw*.35,0]; T.head=[pitch*.65,yaw*.65,Math.sin(t*.6+c.seed)*.04]; }
      if(!preview&&c.warm&&!c.sleep&&mood!=="day"){ T.shL=[-1.12,.28,-.05]; T.shR=[-1.12,-.28,.05]; T.elL=[-.55,0,0]; T.elR=[-.55,0,0]; const r=Math.sin(t*3+c.seed)*.06; T.elL[0]+=r; T.elR[0]-=r; }
      if(c.talk>0){ const g=Math.sin(t*4.2+c.seed), g2=Math.sin(t*2.1+c.seed*2);
        if(g2>0){ T.shR=[-.95+g*.18,-.25,.3]; T.elR=[-1.25+g*.3,0,0]; } else { T.shL=[-.95+g*.18,.25,-.3]; T.elL=[-1.25+g*.3,0,0]; }
        T.head[0]+=Math.sin(t*7)*.05; T.spine[0]+=.05; }
      if(c.point&&chars[c.point]){ const tg=chars[c.point]; const dd=sub([tg.x,1,tg.z],hp); const plx=dd[0]*Math.cos(f)-dd[2]*Math.sin(f), plz=dd[0]*Math.sin(f)+dd[2]*Math.cos(f);
        const py=clamp(Math.atan2(plx,plz),-1.3,1.3); T.shR=[-1.4,py,.0]; T.elR=[-.12,0,0]; T.neck[1]=py*.35; T.head[1]=py*.65; }
      if(c.sleep){ T.spine=[.38+breath*.5,0,0]; T.neck=[.32,0,0]; T.head=[.38,0,Math.sin(t*.5+c.seed)*.12]; T.shL=[-.3,0,-.05]; T.shR=[-.3,0,.05]; T.elL=[-.6,0,0]; T.elR=[-.6,0,0]; }
      if(c.dying||c.die>=1){ const k=c.dying?clamp(c.dying/.9,0,1):1; const e=k*k*(3-2*k);
        T.pelvis=[-1.35*e,0,0]; T.py=-.32*e; T.pz=-.45*e; T.spine=[-.25*e,0,0]; T.head=[-.3*e,0,.2*e]; T.shL=[-2.4*e,0,-.5*e]; T.shR=[-2.4*e,0,.5*e]; T.elL=[0,0,0]; T.elR=[0,0,0]; T.knL=[1.45*(1-e)+.2*e,0,0]; T.knR=[1.45*(1-e)+.2*e,0,0]; T.hipL=[-1.5*(1-e)-.25*e,0,.05*e]; T.hipR=[-1.5*(1-e)-.25*e,0,-.05*e]; if(c.rig){ T.py=-.42*e; T.pz=-.75*e; } }
      // lissage
      const k=1-Math.exp(-dt*(c.dying?12:6));
      for(const b in T){ if(Array.isArray(T[b])){ const cur=c.pose[b]||T[b]; c.pose[b]=[lerp(cur[0],T[b][0],k),lerp(cur[1],T[b][1],k),lerp(cur[2],T[b][2],k)]; } else c.pose[b]=lerp(c.pose[b]==null?T[b]:c.pose[b],T[b],k); }
    }
    function updateChars(t,dt){
      const ids=order.filter(id=>chars[id]);
      for(const id of ids){ const c=chars[id];
        c.x=lerp(c.x,c.tx,1-Math.exp(-dt*4)); c.z=lerp(c.z,c.tz,1-Math.exp(-dt*4)); c.face=preview?0:Math.atan2(-c.x,-c.z);
        if(c.talk>0) c.talk-=dt;
        if(c.dying){ c.dying+=dt; c.die=clamp(c.dying/2.4,0,1); if(c.die>=1) c.dying=0; } else if(c.alive) c.die=0; else c.die=1;
        c.blink-=dt; if(c.blink<-.13) c.blink=2+Math.random()*4;
        c.lookT-=dt; if(c.lookT<=0){ c.lookT=2+Math.random()*4; const others=ids.filter(x=>x!==id&&chars[x].alive); const r=Math.random();
          c.lookTarget = r<.35||!others.length ? "fire" : pick(others); }
        let spk=null; for(const o of ids) if(o!==id&&chars[o].talk>0) spk=o;
        const tgt=c.point||spk||c.lookTarget; c.look=tgt==="fire"||!chars[tgt]?[0,.6,0]:headPos(chars[tgt]);
        if(id===me&&!spk&&!c.point) c.look=[0,.7,0];
        poseOf(c,t,dt);
        const root=M.trs([c.x,0,c.z],[0,c.face,0],1); c.root=root; c.W=R4.skeleton(root,c.pose);
        if(c.rig){ const P2=c.pose; R4.charPose(c.rig,P2); c.rootR=M.mul(root,M.trs([P2.px||0,preview?0:(.47-c.rig.hipsY)+(P2.py||0),P2.pz||0],[0,0,0],1));
          const hd=c.rig.W[c.rig.id.head_end!=null?c.rig.id.head_end:c.rig.head]; c.headTop=M.xf(c.rootR,[hd[12],hd[13]+.04,hd[14]]);
          const hp=c.rig.W[c.rig.id.Hips]; c.hipsW=M.xf(c.rootR,[hp[12],hp[13],hp[14]]); }
      }
    }
    const pick=a=>a[Math.floor(Math.random()*a.length)];

    /* ---------- particules ---------- */
    function emit(k,p,v,life,size,col,seed){ parts.push({k,p,v,life:0,max:life,s:size,c:col,seed:seed==null?Math.random():seed}); }
    function stepParts(dt,t,S){
      const fireK=1;
      // flammes : grandes nappes + langues
      while(parts.filter(x=>x.k===0&&x.big).length<9){ const a=Math.random()*Math.PI*2,r=Math.random()*.22; const p={k:0,big:true,p:[Math.sin(a)*r,.0,Math.cos(a)*r],v:[0,0,0],life:0,max:1.2+Math.random()*1.5,s:1.35+Math.random()*.8,c:[1,1,1,1],seed:Math.random()}; parts.push(p); }
      if(Math.random()<dt*22){ const a=Math.random()*Math.PI*2,r=Math.random()*.4; emit(0,[Math.sin(a)*r,.15,Math.cos(a)*r],[(Math.random()-.5)*.1,1.1+Math.random()*.7,(Math.random()-.5)*.1],.5+Math.random()*.4,.45+Math.random()*.35,[1,1,1,.9]); }
      if(Math.random()<dt*14) emit(1,[(Math.random()-.5)*.5,.4,(Math.random()-.5)*.5],[(Math.random()-.5)*.5,1.2+Math.random()*1.6,(Math.random()-.5)*.5],1.4+Math.random()*1.8,.045+Math.random()*.03,[1,.45,.12,1]);
      if(Math.random()<dt*3) emit(2,[(Math.random()-.5)*.3,1.7,(Math.random()-.5)*.3],[.12+Math.random()*.1,.55,(Math.random()-.5)*.1],5+Math.random()*3,.8+Math.random()*.6,[.16,.15,.15,.22]);
      if(!preview&&Math.random()<dt*S.night*2.2){ const a=Math.random()*Math.PI*2,r=4+Math.random()*16; emit(2,[Math.sin(a)*r,.25+Math.random()*.4,Math.cos(a)*r],[.18,0,(Math.random()-.5)*.1],10+Math.random()*6,4+Math.random()*3,[S.fog[0]*2.2+.02,S.fog[1]*2.2+.02,S.fog[2]*2.2+.03,.26]); }
      if(!preview&&theme==="winter") for(let i=0;i<Math.round(dt*60+Math.random()*.5);i++){ const a=Math.random()*Math.PI*2,r=Math.random()*20; emit(3,[Math.sin(a)*r,8+Math.random()*3,Math.cos(a)*r],[0,-.6-Math.random()*.4,0],14,.05+Math.random()*.04,[1.4,1.45,1.5,.9]); }
      if(!preview&&theme!=="winter"&&Math.random()<dt*(S.night*.6+(theme==="forest"?.5:0))*3){ const a=Math.random()*Math.PI*2,r=6+Math.random()*14; emit(4,[Math.sin(a)*r,.4+Math.random()*1.6,Math.cos(a)*r],[(Math.random()-.5)*.3,(Math.random()-.5)*.15,(Math.random()-.5)*.3],6+Math.random()*5,.08,[2.5,3,.8,1]); }
      for(let i=parts.length-1;i>=0;i--){ const p=parts[i]; p.life+=dt; if(p.life>p.max){ parts.splice(i,1); continue; }
        p.p[0]+=p.v[0]*dt; p.p[1]+=p.v[1]*dt; p.p[2]+=p.v[2]*dt;
        if(p.k===1){ p.v[0]+=Math.sin(t*3+i)*dt*.8; p.v[1]-=dt*.2; }
        if(p.k===3){ p.v[0]=Math.sin(t*.8+p.seed*20)*.3; if(p.p[1]<0){ parts.splice(i,1); continue; } }
        if(p.k===4){ p.v[0]+=Math.sin(t*1.3+p.seed*9)*dt*.3; p.v[2]+=Math.cos(t*1.1+p.seed*9)*dt*.3; } }
      if(parts.length>3500) parts.splice(0,parts.length-3500);
    }
    function fillParts(add,S,t){
      let n=0; const need=(parts.length+300)*12; if(pdata.length<need) pdata=new Float32Array(need*2);
      const put=(x,y,z,s,r,g,b,a,k,seed,rot)=>{ const o=n*12; pdata[o]=x;pdata[o+1]=y;pdata[o+2]=z;pdata[o+3]=s;pdata[o+4]=r;pdata[o+5]=g;pdata[o+6]=b;pdata[o+7]=a;pdata[o+8]=k;pdata[o+9]=seed;pdata[o+10]=rot;pdata[o+11]=0; n++; };
      const fk=S.fireK;
      for(const p of parts){ const f=p.life/p.max;
        if(add){
          if(p.k===0){ const a=p.big?Math.sin(f*Math.PI)*.85:(1-f)*.8; put(p.p[0],p.p[1],p.p[2],p.big?p.s*(.85+.15*Math.sin(t*3+p.seed*9)):p.s*(1-f*.5),1,1,1,a*fk,0,p.seed,0); }
          else if(p.k===1) put(p.p[0],p.p[1],p.p[2],p.s,p.c[0]*4,p.c[1]*4,p.c[2]*4,(1-f),1,p.seed,0);
          else if(p.k===4){ const b=.5+.5*Math.sin(p.life*5+p.seed*30); put(p.p[0],p.p[1],p.p[2],p.s,p.c[0],p.c[1],p.c[2],b*Math.sin(f*Math.PI)*S.ff,3,p.seed,0); }
        } else {
          if(p.k===2&&p.s<2){ const lit=S.fire; put(p.p[0],p.p[1],p.p[2],p.s*(.6+f*1.6),p.c[0]+lit[0]*.015*(1-f),p.c[1]+lit[1]*.012*(1-f),p.c[2]+lit[2]*.01*(1-f),p.c[3]*(1-f)*Math.min(1,f*4),2,p.seed,p.seed*6); }
          else if(p.k===2) put(p.p[0],p.p[1],p.p[2],p.s,p.c[0],p.c[1],p.c[2],Math.sin(f*Math.PI)*p.c[3],2,p.seed,p.seed*6);
          else if(p.k===3) put(p.p[0],p.p[1],p.p[2],p.s,p.c[0]*S.snowL,p.c[1]*S.snowL,p.c[2]*S.snowL,p.c[3],3,p.seed,0);
        } }
      if(add) for(const [v,tg] of Object.entries(votes)){ const A=chars[v],B=chars[tg]; if(!A||!B||!A.W||!B.W) continue; const a=M.xf(A.W.elR||A.W.head,[0,-.25,0]), b=headPos(B); const col=A.wolf?[3,.5,.4]:[1.6,1.1,3];
        for(let k=0;k<9;k++){ const u=((t*.5+k/9+(v.length%7)*.13)%1); const h=Math.sin(u*Math.PI)*.8; put(lerp(a[0],b[0],u),lerp(a[1],b[1],u)+h,lerp(a[2],b[2],u),.07+.05*Math.sin(u*Math.PI),col[0],col[1],col[2],.9*Math.sin(u*Math.PI)+.1,1,k,0); } }
      return n;
    }

    /* ---------- dessin ---------- */
    let VPm=null, camE=[0,3,8], W=1,H=1, S=null;
    function setLights(p,S,cam){ const u=p.u;
      gl.uniform3fv(u.uCam,cam); gl.uniform3fv(u.uKeyDir,S.keyDir); gl.uniform3fv(u.uKeyCol,S.keyCol); gl.uniform3fv(u.uSkyCol,S.sky); gl.uniform3fv(u.uGndCol,S.gnd);
      gl.uniform3fv(u.uFogCol,S.fog); gl.uniform3fv(u.uFogSun,S.fogSun); gl.uniform1f(u.uFogD,S.fogD); gl.uniform1f(u.uFogH,S.fogH);
      gl.uniform3fv(u.uFireP,S.fireP); gl.uniform3fv(u.uFireC,S.fire); gl.uniform1f(u.uFireR,S.fireR);
      const lp=new Float32Array(12); (S.lamps||[]).forEach((L,i)=>lp.set(L,i*3)); for(let i=(S.lamps||[]).length;i<4;i++) lp.set([0,-50,0],i*3); gl.uniform3fv(u.uLamp,lp); gl.uniform3fv(u.uLampC,S.lampC);
      gl.uniform1f(u.uShadowOn,S.shadowOn); gl.uniform1f(u.uSnow,theme==="winter"?1:0); gl.uniformMatrix4fv(u.uLightVP,false,S.lightVP); if(u.uShTexel) gl.uniform1f(u.uShTexel,1/(SH?SH.size:1024));
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,SH.t); gl.uniform1i(u.uShadow,1);
      if(u.uFireSh){ gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_CUBE_MAP,FS.t); gl.uniform1i(u.uFireSh,2); gl.uniform1f(u.uFireShOn,S.fireShOn); }
      if(u.uGround) gl.uniform1f(u.uGround,theme==="winter"?0:1); if(u.uClr) gl.uniform1f(u.uClr,S.clr);
      if(u.uAlb){ gl.uniform1i(u.uAlb,3); gl.uniform1i(u.uNrm,4); }
      gl.activeTexture(gl.TEXTURE0); }
    function drawM(p,m,Mx,opts){ const u=p.u; gl.uniformMatrix4fv(u.uM,false,Mx);
      if(u.uTint) gl.uniform3fv(u.uTint,(opts&&opts.tint)||[1,1,1]); if(u.uHi!=null) gl.uniform1f(u.uHi,(opts&&opts.hi)||0); if(u.uHiCol) gl.uniform3fv(u.uHiCol,(opts&&opts.hic)||[0,0,0]);
      if(u.uAlpha) gl.uniform1f(u.uAlpha,opts&&opts.alpha!=null?opts.alpha:1); if(u.uWin!=null) gl.uniform1f(u.uWin,S.win);
      gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES,0,m.n); }
    const I=M.id();
    function drawChars(p,isMain,t,sp){
      for(const id of order){ const c=chars[id]; if(!c||!c.W) continue;
        gl.uniformMatrix4fv(p.u.uM,false,c.root);
        if(!preview){ drawM(p,logM,M.mul(c.root,M.trs([0,0,-.03],[0,0,0],c.rig?1.08:1)),null); }
        if(c.die<1){ const alpha=c.dying?clamp(1-(c.die-.45)/.55,0,1):1; const hi=isMain&&!c.dying?(id===hover?1:(c.click?.4+.25*Math.sin(t*4):0)):0;
          const o={tint:c.inact?[.55,.55,.62]:[1,1,1],hi,hic:id===hover?[1.2,.9,.4]:[.7,.5,1.4],alpha};
          const g=c.rig&&sp&&R4.charGPU(gl,c.rig.slug);
          if(g){ gl.useProgram(sp.p); const u=sp.u; gl.uniformMatrix4fv(u.uM,false,c.rootR); gl.uniformMatrix4fv(u.uB,false,c.rig.mats);
            if(u.uTint){ gl.uniform3fv(u.uTint,o.tint); gl.uniform1f(u.uHi,o.hi); gl.uniform3fv(u.uHiCol,o.hic); gl.uniform1f(u.uAlpha,o.alpha); gl.uniform1f(u.uWin,S.win);
              gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D,g.alb); gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D,g.nrm); gl.activeTexture(gl.TEXTURE0); }
            gl.bindVertexArray(g.vao); gl.drawElements(gl.TRIANGLES,g.n,g.type,0); gl.useProgram(p.p); }
          else if(!c.slug) for(const part in R4.PARTS){ const m=c.m[part]; if(!m) continue; let Mx=c.W[R4.PARTS[part]];
            if(R4.PART_OFF[part]){ let sy=1; if(part==="eyes") sy=(c.sleep||c.die>.3)?.08:(c.blink<0?.1:1); if(part==="mouth") sy=c.talk>0?.5+Math.abs(Math.sin(t*11+c.seed))*1.8:1; Mx=M.mul(Mx,M.trs(R4.PART_OFF[part],[0,0,0],1,sy)); }
            drawM(p,m,Mx,o); } }
        if(c.die>.6&&!preview){ const r=clamp((c.die-.6)/.4,0,1); drawM(p,graveM,M.mul(c.root,M.trs([0,-(1-r)*1.1,-.75],[0,0,0],1)),null); }
        if(isMain&&c.sel&&c.die<1){ gl.uniform1f(p.u.uWin,1); drawM(p,ringM,M.trs([c.x,0,c.z],[0,0,0],1+.04*Math.sin(t*5)),{hi:0}); }
      }
    }
    function frame(){
      raf=requestAnimationFrame(frame);
      if(paused||document.hidden) return;
      render(); }
    function render(){
      const now=performance.now(), t=(now-T0)/1000, dt=Math.min(.05,(now-(last||now))/1000); last=now;
      // taille
      const dpr=Math.min(window.devicePixelRatio||1,q.dpr); const offs=!canvas.clientWidth; const w=offs?canvas.width:Math.max(2,Math.floor(canvas.clientWidth*dpr)), h=offs?canvas.height:Math.max(2,Math.floor(canvas.clientHeight*dpr));
      if(!offs&&(canvas.width!==w||canvas.height!==h)){ canvas.width=w; canvas.height=h; }
      if(!RT||RT.w!==w||RT.h!==h) makeRT(w,h);
      W=offs?w:canvas.clientWidth; H=offs?h:canvas.clientHeight;
      // heure du jour : avance toujours vers l'avant (vrai crépuscule / vraie aube)
      let d=(todT-tod)%1; if(d<0) d+=1; if(d>1e-4){ const sp=Math.max(.012,Math.min(.11,d*.9)); const st=Math.min(d,sp*dt); tod=(tod+st)%1; cine=lerp(cine,d>.03?1:0,1-Math.exp(-dt*1.5)); } else cine=lerp(cine,0,1-Math.exp(-dt*1.5));
      const e=Math.sin(2*Math.PI*(tod-.25));
      updateChars(t,dt);
      // caméra
      const meC=me&&chars[me]; let base=meC?Math.atan2(meC.x,meC.z):camYaw; if(preview) base=0;
      const R=meC?meC.R:(order.length?chars[order[0]]&&chars[order[0]].R||3:3);
      let eye,at;
      if(preview&&headMode){ const c=chars.me, hy=c&&c.headTop?c.headTop[1]-.16:1.5; eye=[.12,hy+.02,.78]; at=[0,hy-.01,0]; }
      else if(preview&&cheer){ eye=[.7,1.45,2.3]; at=[0,1.12,0]; }
      else if(preview){ const a=Math.sin(t*.35)*.4+drag+.2; eye=[Math.sin(a)*3.9,1.45,Math.cos(a)*3.9]; at=[0,.95,0]; }
      else { const a=base+drag; const dist=(R+3.4)*zoom+cine*2.2; const hgt=(2.9+R*.12)*zoom+cine*1.2+Math.sin(t*.3)*.05; eye=[Math.sin(a+Math.sin(t*.13)*.03)*dist,hgt,Math.cos(a+Math.sin(t*.13)*.03)*dist]; at=[0,.45+cine*1.6,0]; }
      camE=eye; const fov=preview?32:52;
      const proj=M.persp(fov*Math.PI/180,W/H,.08,600), view=M.lookAt(eye,at,[0,1,0]); VPm=M.mul(proj,view);
      // soleil & lune placés par rapport à la caméra (coucher de soleil visible)
      const fw=nrm([at[0]-eye[0],0,at[2]-eye[2]]), rt=nrm(cross(fw,[0,1,0]));
      const hz=Math.sqrt(Math.max(0,1-e*e)); const sunH=nrm(add(scl(fw,Math.cos(2*Math.PI*(tod-.25))>0?.8:.8),scl(rt,Math.cos(2*Math.PI*(tod-.25))*.9)));
      const sunDir=nrm(add(scl(sunH,hz),[0,e,0]));
      const me2=-e, mz=Math.sqrt(Math.max(0,1-me2*me2)); const moonDir=nrm(add(scl(nrm(add(fw,scl(rt,-.45))),mz),[0,me2*.85+.08,0]));
      const wolves=mood==="wolves"; S=skyState(e,wolves,theme==="winter");
      let keyDir,keyCol;
      if(e>-.03){ keyDir=sunDir; keyCol=scl(S.sun,smooth(-.03,.06,e)); }
      else { keyDir=moonDir; keyCol=scl(wolves?[.55,.18,.14]:[.32,.42,.72],.6*smooth(-.03,-.2,e)); }
      if(preview){ keyDir=nrm([eye[0]+1.8,2.6,eye[2]+.5]); keyCol=[2.3,1.75,1.3]; }
      S.keyDir=keyDir; S.keyCol=keyCol; S.fogSun=scl(keyCol,.12);
      const fl=.82+.12*Math.sin(t*11.3)+.07*Math.sin(t*6.1+1.3)+.05*Math.sin(t*23.7);
      S.fireK=1; S.fire=scl(wolves?[1,.32,.12]:[1,.48,.17],lerp(2.2,7.5,S.night)*fl); S.fireP=preview?[-2.2,1.1,1.8]:[Math.sin(t*4.1)*.05,1.0+Math.sin(t*7)*.04,Math.cos(t*3.3)*.05]; if(preview) S.fire=scl(S.fire,.35); S.fireR=preview?8:16;
      S.clr=preview?0:R+1.2; S.lamps=world?world.lamps:[]; S.lampC=scl([1,.55,.22],1.8*S.night+.1); S.win=smooth(.1,-.1,e)*.9+.1*S.night; S.ff=S.night; S.snowL=Math.max(.15,S.sky[1]*3+S.fire[0]*.02);
      // matrice de lumière (ombres)
      const lc=[0,0,0], ld=keyDir; const lv=M.lookAt(add(lc,scl(ld,40)),lc,Math.abs(ld[1])>.95?[0,0,1]:[0,1,0]); const ext=preview?3:14; S.lightVP=M.mul(M.ortho(-ext,ext,-ext,ext,1,90),lv);
      S.shadowOn=(q.shadow&&length3(keyCol)>.02)?1:0; S.fireShOn=q.fireSh&&!preview?1:0;
      if(!preview) stepParts(dt,t,S);
      // --- passe ombre soleil
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
      const dp=P.depth;
      if(S.shadowOn){ gl.bindFramebuffer(gl.FRAMEBUFFER,SH.f); gl.viewport(0,0,SH.size,SH.size); gl.clear(gl.DEPTH_BUFFER_BIT); gl.useProgram(dp.p);
        gl.uniformMatrix4fv(dp.u.uVP,false,S.lightVP); gl.uniform1f(dp.u.uTime,t); gl.uniform1f(dp.u.uWind,1); gl.uniform1f(dp.u.uCube,0);
        gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2,4);
        { const k=P.skinD; gl.useProgram(k.p); gl.uniformMatrix4fv(k.u.uVP,false,S.lightVP); gl.uniform1f(k.u.uCube,0); gl.useProgram(dp.p); }
        if(world){ drawM(dp,world.near,I); drawM(dp,world.far,I); } drawChars(dp,false,t,P.skinD);
        if(world&&world.kit){ const k=P.kitD; gl.useProgram(k.p); gl.uniformMatrix4fv(k.u.uVP,false,S.lightVP); gl.uniform1f(k.u.uCube,0); gl.uniform1f(k.u.uTime,t); gl.uniform1f(k.u.uWind,1); gl.uniform1i(k.u.uAlb,3); gl.disable(gl.CULL_FACE); drawKit(k,true); gl.uniform1f(k.u.uCut,0); gl.useProgram(dp.p); }
        gl.disable(gl.POLYGON_OFFSET_FILL); }
      // --- passe ombre du feu (6 faces)
      if(S.fireShOn){ gl.useProgram(dp.p); gl.uniform1f(dp.u.uCube,1); gl.uniform3fv(dp.u.uFireP,S.fireP); gl.uniform1f(dp.u.uTime,t); gl.uniform1f(dp.u.uWind,1);
        const dirs=[[[1,0,0],[0,-1,0]],[[-1,0,0],[0,-1,0]],[[0,1,0],[0,0,1]],[[0,-1,0],[0,0,-1]],[[0,0,1],[0,-1,0]],[[0,0,-1],[0,-1,0]]]; const pr=M.persp(Math.PI/2,1,.05,30);
        for(let i=0;i<6;i++){ gl.bindFramebuffer(gl.FRAMEBUFFER,FS.f[i]); gl.viewport(0,0,FS.size,FS.size); gl.clearColor(100,100,100,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
          const fvp=M.mul(pr,M.lookAt(S.fireP,add(S.fireP,dirs[i][0]),dirs[i][1])); gl.uniformMatrix4fv(dp.u.uVP,false,fvp);
          { const k=P.skinD; gl.useProgram(k.p); gl.uniformMatrix4fv(k.u.uVP,false,fvp); gl.uniform1f(k.u.uCube,1); gl.uniform3fv(k.u.uFireP,S.fireP); gl.useProgram(dp.p); }
          drawChars(dp,false,t,P.skinD); } }
      // --- passe principale
      gl.bindFramebuffer(gl.FRAMEBUFFER,RT.ms||RT.sceneF); gl.viewport(0,0,w,h); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      // ciel
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false); const sp=P.sky; gl.useProgram(sp.p);
      const f3=nrm(sub(at,eye)), r3=nrm(cross(f3,[0,1,0])), u3=cross(r3,f3);
      gl.uniform3fv(sp.u.uR,r3); gl.uniform3fv(sp.u.uU,u3); gl.uniform3fv(sp.u.uF,f3); gl.uniform1f(sp.u.uTH,Math.tan(fov/2*Math.PI/180)); gl.uniform1f(sp.u.uAsp,W/H);
      gl.uniform3fv(sp.u.uZen,S.zen); gl.uniform3fv(sp.u.uHor,S.hor); gl.uniform3fv(sp.u.uSunDir,sunDir); gl.uniform3fv(sp.u.uSunCol,scl(S.sun.every(v=>v===0)?[1.5,.5,.15]:S.sun,S.glow));
      gl.uniform3fv(sp.u.uMoonDir,moonDir); gl.uniform3fv(sp.u.uMoonCol,scl(wolves?[1.5,.45,.3]:[1.1,1.12,1.2],smooth(.1,-.1,e))); gl.uniform3fv(sp.u.uFogCol,S.fog);
      gl.uniform3fv(sp.u.uCloudCol,S.cl); gl.uniform3fv(sp.u.uCloudLit,S.lit); gl.uniform1f(sp.u.uStars,S.stars); gl.uniform1f(sp.u.uTime,t); gl.uniform1f(sp.u.uCloud,preview?0:S.cloud); gl.uniform1f(sp.u.uGlow,S.glow);
      gl.bindVertexArray(quad); gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.enable(gl.CULL_FACE);
      // monde
      const p=P.std; gl.useProgram(p.p); gl.uniformMatrix4fv(p.u.uVP,false,VPm); gl.uniform1f(p.u.uTime,t); gl.uniform1f(p.u.uWind,theme==="winter"?1.4:1); setLights(p,S,eye);
      if(world){ gl.disable(gl.CULL_FACE); drawM(p,world.far,I); drawM(p,world.near,I); gl.enable(gl.CULL_FACE); }
      if(world&&world.kit){ const k=P.kit; gl.useProgram(k.p); gl.uniformMatrix4fv(k.u.uVP,false,VPm); gl.uniform1f(k.u.uTime,t); gl.uniform1f(k.u.uWind,theme==="winter"?1.4:1); setLights(k,S,eye); gl.disable(gl.CULL_FACE); drawKit(k,false); gl.useProgram(p.p); }
      else { /* aperçu : petit sol */ if(!prevGround){ const g=new R4.Geo(); g.cyl({t:[0,-.05,0]},1.4,1.5,.05,40,R4.lin([.22,.3,.14]),4); for(let i=0;i<9;i++){ const a=i/9*Math.PI*2; g.blob({t:[Math.sin(a)*1.45,.05,Math.cos(a)*1.45],s:[1,.6,1]},.14,1,.3,2,i,R4.lin([.4,.4,.4]),5); } prevGround=R4.mesh(gl,g); } drawM(p,prevGround,I); }
      { const k=P.skin; gl.useProgram(k.p); gl.uniformMatrix4fv(k.u.uVP,false,VPm); gl.uniform1f(k.u.uTime,t); setLights(k,S,eye); gl.useProgram(p.p); }
      gl.disable(gl.CULL_FACE); drawChars(p,true,t,P.skin);
      // yeux de loups dans la forêt
      if(!preview&&S.night>.4){ gl.uniform1f(p.u.uFogD,0); const n=wolves?10:5;
        for(let i=0;i<n;i++){ const a=hash(i*13.3)*Math.PI*2, r=14+hash(i*4.1)*6; const x=Math.sin(a)*r,z=Math.cos(a)*r; const bl=Math.sin(t*.5+i*2.3); if(bl<-.3) continue; const open=clamp((Math.sin(t*2.7+i*5)+1)*4,0.05,1);
          drawM(p,eyesM,M.trs([x+Math.sin(t*.2+i)*.5,.75+hash(i)*.6,z],[0,Math.atan2(eye[0]-x,eye[2]-z),0],2.2,2.2*open),{tint:wolves?[1,.25,.15]:[1,1,1]}); }
        gl.uniform1f(p.u.uFogD,S.fogD); }
      // herbe
      if(grass&&!preview&&theme!=="winter"){ const g=P.grass; gl.useProgram(g.p); gl.uniformMatrix4fv(g.u.uVP,false,VPm); gl.uniform1f(g.u.uTime,t); gl.uniform1f(g.u.uWind,theme==="winter"?1.4:1); setLights(g,S,eye);
        gl.bindVertexArray(grass.vao); gl.drawArraysInstanced(gl.TRIANGLES,0,grass.n,grass.count); }
      // particules
      const pp=P.part; gl.useProgram(pp.p); gl.uniformMatrix4fv(pp.u.uVP,false,VPm); gl.uniform3fv(pp.u.uR,r3); gl.uniform3fv(pp.u.uU,u3); gl.uniform1f(pp.u.uTime,t);
      gl.depthMask(false); gl.enable(gl.BLEND); gl.bindVertexArray(pvao);
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); let n=fillParts(false,S,t); if(n){ gl.bindBuffer(gl.ARRAY_BUFFER,pinst); gl.bufferData(gl.ARRAY_BUFFER,pdata.subarray(0,n*12),gl.DYNAMIC_DRAW); gl.uniform1f(pp.u.uAdd,0); gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,n); }
      gl.blendFunc(gl.ONE,gl.ONE); n=fillParts(true,S,t); if(n){ gl.bindBuffer(gl.ARRAY_BUFFER,pinst); gl.bufferData(gl.ARRAY_BUFFER,pdata.subarray(0,n*12),gl.DYNAMIC_DRAW); gl.uniform1f(pp.u.uAdd,1); gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,n); }
      gl.disable(gl.BLEND); gl.depthMask(true); gl.bindVertexArray(null);
      // résolution MSAA
      if(RT.ms){ gl.bindFramebuffer(gl.READ_FRAMEBUFFER,RT.ms); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,RT.sceneF); gl.blitFramebuffer(0,0,w,h,0,0,w,h,gl.COLOR_BUFFER_BIT,gl.NEAREST); }
      // bloom
      gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(quad);
      const pass=(prog,fbo,vw,vh,texs,px)=>{ gl.bindFramebuffer(gl.FRAMEBUFFER,fbo); gl.viewport(0,0,vw,vh); gl.useProgram(prog.p); let i=0; for(const [nm,tx] of texs){ gl.activeTexture(gl.TEXTURE0+i); gl.bindTexture(gl.TEXTURE_2D,tx); gl.uniform1i(prog.u[nm],i); i++; } if(prog.u.uPx) gl.uniform2fv(prog.u.uPx,px); gl.drawArrays(gl.TRIANGLE_STRIP,0,4); };
      const L=RT.lv;
      pass(P.bright,L[0].fa,L[0].w,L[0].h,[["uTex",RT.scene]],[1/w,1/h]);
      for(let i=1;i<L.length;i++) pass(P.down,L[i].fa,L[i].w,L[i].h,[["uTex",L[i-1].fa===null?null:L[i-1].a]],[1/L[i-1].w,1/L[i-1].h]);
      // remontée : b[i] = up(a[i+1] ou b[i+1]) + a[i]
      for(let i=L.length-2;i>=0;i--){ const src=i===L.length-2?L[i+1].a:L[i+1].b; pass(P.up,L[i].fb,L[i].w,L[i].h,[["uTex",src],["uPrev",L[i].a]],[1/L[i+1].w,1/L[i+1].h]); }
      // composition
      gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,w,h); const cp=P.comp; gl.useProgram(cp.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,RT.scene); gl.uniform1i(cp.u.uScene,0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,L[0].b); gl.uniform1i(cp.u.uBloom,1);
      gl.uniform1f(cp.u.uExp,(preview?Math.min(S.exp*1.1,1.05):S.exp)*(theme==="winter"?lerp(.62,.9,S.night):1)); gl.uniform1f(cp.u.uBloomK,q.bloom?.22:0); gl.uniform1f(cp.u.uVig,preview?.35:lerp(.35,.8,S.night)); gl.uniform1f(cp.u.uTime,t); gl.uniform1f(cp.u.uGrain,.018);
      gl.uniform3fv(cp.u.uLift,wolves?[.035,0,0]:lerp3([0,0,0],[0,.006,.02],S.night)); gl.uniform3fv(cp.u.uGain,wolves?[1.12,.86,.84]:lerp3([1.03,1,.97],[.94,.97,1.08],S.night)); gl.uniform3fv(cp.u.uVigCol,wolves?[.06,0,0]:[0,0,0]);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4); gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
      // étiquettes
      if(labels){ for(const el of labels.children){ const a=anchor(el.dataset.id); if(!a||!a.vis){ el.style.display="none"; continue; } el.style.display=""; const s=clamp(7/a.w,.6,1.15);
        el.style.transform=`translate(${a.x.toFixed(1)}px,${a.y.toFixed(1)}px) translate(-50%,-100%) scale(${s.toFixed(3)})`; el.style.zIndex=String(1000-Math.round(a.w*10)); } }
    }
    let prevGround=null, raf=0, labels=opts.labels||null, cheer=false, headMode=false, onReady=null;
    const length3=a=>Math.hypot(a[0],a[1],a[2]);
    function project(p){ const m=VPm; if(!m) return {x:0,y:0,w:-1}; const x=m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], y=m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15]; return {x:(x/w*.5+.5)*W,y:(1-(y/w*.5+.5))*H,w}; }
    function anchor(id){ const c=chars[id]; if(!c||!c.W) return null; const hp=c.die>=1?[c.x,1.25,c.z]:add(headPos(c),[0,c.rig?.22:.36,0]); const a=project(hp); return {x:a.x,y:a.y,w:a.w,vis:a.w>0}; }
    function hit(e){ const r=canvas.getBoundingClientRect(); const mx=e.clientX-r.left,my=e.clientY-r.top; let best=null,bd=1e9;
      for(const id of order){ const c=chars[id]; if(!c||!c.W) continue; const pts=c.rig&&c.hipsW?[c.hipsW,M.xf(c.rootR||c.root,[0,1.05,0]),headPos(c)]:[M.xf(c.W.spine,[0,.25,0]),headPos(c)]; for(const pt of pts){ const a=project(pt); if(a.w<=0) continue; const rad=H*.42/a.w; const d=Math.hypot(mx-a.x,my-a.y); if(d<rad&&d<bd){ bd=d; best=id; } } }
      return best; }
    canvas.addEventListener("pointermove",e=>{ if(dragging){ drag+=(e.clientX-dragX)*.005; dragX=e.clientX; moved++; return; } if(preview) return; const id=hit(e); hover=id&&canPick(id)?id:null; canvas.style.cursor=hover?"pointer":"grab"; });
    canvas.addEventListener("pointerdown",e=>{ dragging=true; dragX=e.clientX; moved=0; downId=preview?null:hit(e); });
    window.addEventListener("pointerup",()=>{ if(!dragging) return; dragging=false; if(moved<4&&downId&&canPick(downId)&&onPick) onPick(downId); });
    canvas.addEventListener("wheel",e=>{ if(preview) return; zoom=clamp(zoom*(e.deltaY>0?1.07:.94),.65,1.6); e.preventDefault(); },{passive:false});
    if(preview){ setPlayers([{id:"me",av:opts.av||{},alive:true}],"me"); }
    applyQuality(); frame();
    return {
      setPlayers, setVotes(v){ votes=v||{}; }, speak(id){ if(chars[id]) chars[id].talk=2.4; },
      setMood(m){ if(MOOD_TOD[m]==null) return; mood=m; todT=MOOD_TOD[m]; },
      setTheme(th){ if(th===theme||preview) return; parts.length=0; loadWorld(th); },
      onCharReady(f){ onReady=f; }, charReady(){ const c=chars.me; return !c||!c.slug||!!c.rig; },
      setQuality(k){ if(!QUAL[k]) return; qk=k; q=Object.assign({},QUAL[k]); for(const id in chars){ chars[id].key=null; } if(!hasFloat) q.msaa=0; applyQuality(); RT=null; },
      setAvatar(av){ if(preview) setPlayers([{id:"me",av,alive:true}],"me"); },
      setPick(fn,can){ onPick=fn; canPick=can; }, setLabels(el){ labels=el; },
      pause(b){ paused=!!b; }, anchor,
      whenReady(){ const c=chars.me; if(!c||!c.slug) return Promise.resolve(); return new Promise(r=>{ const k=()=>{ if(!chars.me||!chars.me.slug||(chars.me.rig&&chars.me.rig.slug===chars.me.slug)) r(); else setTimeout(k,30); }; k(); }); },
      snap(av,m,ch,hd){ cheer=!!ch; headMode=!!hd; if(m&&MOOD_TOD[m]!=null){ mood=m; tod=todT=MOOD_TOD[m]; } setPlayers([{id:"me",av,alive:true}],"me"); chars.me.pose={}; last=0; render(); return canvas.toDataURL("image/jpeg",.88); }, destroy(){ cancelAnimationFrame(raf); }
    };
  };
})();

/* ---------- façade : même API que l'ancien moteur, repli WebGL1 ---------- */
const V3=(function(){
  let eng=null, legacy=false, ok=false;
  const qs=()=>typeof QS!=="undefined"?QS:new URLSearchParams(location.search);
  function init(cv,lab,th){
    const q=(typeof APP!=="undefined"&&APP.set&&APP.set.gq)||"med";
    if(!qs().get("r3")){ try{ eng=R4.create(cv,{theme:th,quality:q,labels:lab}); }catch(e){ console.warn("R4",e); eng=null; } }
    if(eng){ ok=true; return true; }
    // le canvas a peut-être déjà un contexte WebGL2 : on le remplace
    let c2=cv; if(cv.parentNode){ c2=cv.cloneNode(); cv.replaceWith(c2); if(typeof APP!=="undefined") APP.v3cv=c2; }
    legacy=true; ok=V3L.init(c2,lab,th==="camp"?"forest":th); return ok;
  }
  const E=()=>legacy?V3L:eng;
  return {
    init,
    setPlayers:(l,m)=>E()&&E().setPlayers(l,m), setVotes:v=>E()&&E().setVotes(v), setMood:m=>E()&&E().setMood(m),
    setTheme:th=>E()&&E().setTheme(legacy&&th==="camp"?"forest":th), pause:b=>E()&&E().pause(b), speak:id=>E()&&E().speak(id),
    setPick:(f,c)=>E()&&E().setPick(f,c), anchor:id=>E()?E().anchor(id):null,
    setQuality:k=>{ if(eng) eng.setQuality(k); }, get ok(){ return ok; }, get r4(){ return !!eng; }
  };
})();

/* portraits 3D (écran de fin) */
R4.portraitAsync=function(av,mood,big){ const run=()=>R4._portraitAsync(av,mood,big); R4._pq=(R4._pq||Promise.resolve()).then(run,run); return R4._pq; };
R4._portraitAsync=async function(av,mood,big){
  const slug=R4.charSlug&&R4.charSlug(R4.avNorm(av)); if(slug){ try{ await R4.loadChar(slug); }catch(e){} }
  if(R4._ps===undefined) R4.portrait(av,mood,big); if(!R4._ps) return null;
  R4._ps.snap(av,mood,true); await R4._ps.whenReady(); R4._pc&&R4._pc.delete(JSON.stringify([av,mood,big]));
  return R4.portrait(av,mood,big);
};
// petites têtes (votes, chat…) : une par personnage réaliste, en cache
R4.headshotAsync=function(slug){
  R4._hs=R4._hs||{}; if(R4._hs[slug]) return R4._hs[slug];
  const run=async()=>{ try{ await R4.loadChar(slug); }catch(e){ return null; }
    if(R4._ps===undefined) R4.portrait({},"dusk",false); if(!R4._ps) return null;
    const av={rc:R4.CHAR_LIST.indexOf(slug)}; const c=R4._pcv, w=c.width, h=c.height; c.width=c.height=112;
    R4._ps.snap(av,"day",false,true); await R4._ps.whenReady(); R4._ps.snap(av,"day",false,true); const u=R4._ps.snap(av,"day",false,true);
    c.width=w; c.height=h; return u; };
  R4._pq=(R4._pq||Promise.resolve()).then(run,run); return R4._hs[slug]=R4._pq;
};
R4.portrait=function(av,mood,big){
  const k=JSON.stringify([av,mood,big]); R4._pc=R4._pc||new Map(); if(R4._pc.has(k)) return R4._pc.get(k);
  if(R4._ps===undefined){ const c=document.createElement("canvas"); c.width=240; c.height=320; try{ R4._ps=R4.create(c,{preview:true,quality:"med",mood:"dusk"}); if(R4._ps) R4._ps.pause(true); }catch(e){ R4._ps=null; } R4._pcv=c; }
  if(!R4._ps) return null;
  const s=big?1:.6; if(R4._pcv.width!==Math.round(240*s)){ R4._pcv.width=Math.round(240*s); R4._pcv.height=Math.round(320*s); }
  let u=null; try{ u=R4._ps.snap(av,mood,true); }catch(e){ console.warn(e); }
  if(u) R4._pc.set(k,u); return u;
};
