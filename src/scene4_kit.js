/* ===================== R4 : décors texturés (Quaternius « Stylized Nature MegaKit », CC0) ===================== */
(function(){
  "use strict";
  const {M,hash}=R4;
  R4.KITS={}; const kw={}, kl={};
  window.HURLUNE_KIT=function(name,d){ R4.KITS[name]=d; (kw[name]||[]).forEach(f=>f[0](d)); delete kw[name]; };
  R4.loadKit=function(name){
    if(R4.KITS[name]) return Promise.resolve(R4.KITS[name]);
    return new Promise((res,rej)=>{ (kw[name]=kw[name]||[]).push([res,rej]); if(kl[name]) return; kl[name]=true;
      const s=document.createElement("script"); s.src="chars/"+name+".js"; s.async=true;
      s.onerror=()=>{ kl[name]=false; (kw[name]||[]).forEach(f=>f[1](new Error("kit "+name))); delete kw[name]; }; document.head.appendChild(s); });
  };
  const dec=new Map();
  function model(name){
    if(dec.has(name)) return dec.get(name); const K=R4.KITS.nature; const src=K&&K.models[name]; if(!src) return null;
    const out=src.map(p=>{ const b=Uint8Array.from(atob(p.b),c=>c.charCodeAt(0)); const nv=p.nv; let o=0;
      const u16=(n)=>{ const a=new Uint16Array(b.slice(o,o+n*2).buffer); o+=n*2; return a; };
      const qp=u16(nv*3), nr=new Int8Array(b.slice(o,o+nv*4).buffer); o+=nv*4; const qu=u16(nv*2); const cl=b.slice(o,o+nv*4); o+=nv*4;
      const idx=p.i32?new Uint32Array(b.slice(o,o+p.ni*4).buffer):new Uint16Array(b.slice(o,o+p.ni*2).buffer);
      const pos=new Float32Array(nv*3), uv=new Float32Array(nv*2);
      for(let i=0;i<nv;i++){ for(let c=0;c<3;c++) pos[i*3+c]=p.pl[c]+qp[i*3+c]/65535*(p.ph[c]-p.pl[c]); for(let c=0;c<2;c++) uv[i*2+c]=p.ul[c]+qu[i*2+c]/65535*(p.uh[c]-p.ul[c]); }
      return {m:p.m,nv,pos,nr,uv,cl,idx}; });
    dec.set(name,out); return out;
  }
  // matériaux : réglages artistiques
  const MAT={ Leaves_Pine:{tint:[.78,.86,.78]}, Leaves_NormalTree:{tint:[.85,.9,.8]}, Leaves_TwistedTree:{tint:[.2,.34,.12]}, Leaves:{tint:[.8,.88,.75]},
    Grass:{tint:[.42,.62,.24],vc:1}, Flowers:{tint:[1,1,1]}, Bark_NormalTree:{vc:.5}, Bark_DeadTree:{vc:.5,tint:[.85,.82,.8]}, Bark_TwistedTree:{vc:.5}, Rocks:{tint:[.9,.9,.92]}, PathRocks:{}, Mushrooms:{} };
  // fusion de toutes les instances par matériau -> peu d'appels de dessin
  R4.buildKit=function(gl,list,snow){
    const K=R4.KITS.nature; if(!K||!list||!list.length) return null;
    const groups={};
    for(const it of list){ const mdl=model(it.n); if(!mdl) continue; const c=Math.cos(it.ry||0), s=Math.sin(it.ry||0), sc=it.s||1;
      for(const p of mdl){ const g=groups[p.m]=groups[p.m]||{v:[],i:[],nv:0};
        const base=g.nv; const V=new Float32Array(p.nv*11);
        for(let k=0;k<p.nv;k++){ const x=p.pos[k*3]*sc, y=p.pos[k*3+1]*sc, z=p.pos[k*3+2]*sc; const o=k*11;
          V[o]=it.t[0]+x*c+z*s; V[o+1]=it.t[1]+y; V[o+2]=it.t[2]-x*s+z*c;
          const nx=p.nr[k*4]/127, ny=p.nr[k*4+1]/127, nz=p.nr[k*4+2]/127; V[o+3]=nx*c+nz*s; V[o+4]=ny; V[o+5]=-nx*s+nz*c;
          V[o+6]=p.uv[k*2]; V[o+7]=p.uv[k*2+1]; V[o+8]=p.cl[k*4]/255; V[o+9]=p.cl[k*4+1]/255; V[o+10]=p.cl[k*4+2]/255; }
        g.v.push(V); const I=new Uint32Array(p.idx.length); for(let k=0;k<p.idx.length;k++) I[k]=p.idx[k]+base; g.i.push(I); g.nv+=p.nv; } }
    const out=[];
    for(const m in groups){ const g=groups[m]; const meta=K.mats[m]||{}; const set=MAT[m]||{};
      let n=0; for(const a of g.v) n+=a.length; const V=new Float32Array(n); let o=0; for(const a of g.v){ V.set(a,o); o+=a.length; }
      n=0; for(const a of g.i) n+=a.length; const I=new Uint32Array(n); o=0; for(const a of g.i){ I.set(a,o); o+=a.length; }
      const vao=gl.createVertexArray(); gl.bindVertexArray(vao); const vb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,vb); gl.bufferData(gl.ARRAY_BUFFER,V,gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,44,0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,44,12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,2,gl.FLOAT,false,44,24); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3,3,gl.FLOAT,false,44,32);
      const ib=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,I,gl.STATIC_DRAW); gl.bindVertexArray(null);
      out.push({m,vao,vb,ib,n:I.length,alb:tex(gl,meta.c,true),nrm:meta.n?tex(gl,meta.n,false):null,cut:meta.a?1:0,leaf:meta.leaf?1:0,rock:meta.rock?1:0,tint:set.tint||[1,1,1],vc:set.vc!=null?set.vc:0}); }
    return out;
  };
  R4.freeKit=function(gl,k){ if(!k) return; for(const g of k){ gl.deleteVertexArray(g.vao); gl.deleteBuffer(g.vb); gl.deleteBuffer(g.ib); } };
  const texCache=new WeakMap();
  function tex(gl,name,srgb){
    let C=texCache.get(gl); if(!C){ C={}; texCache.set(gl,C); } const key=name+(srgb?"s":"l"); if(C[key]) return C[key];
    const T=R4.KITS.nature.tex[name]; const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(srgb?[90,110,70,0]:[128,128,255,255]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
    if(T){ const bin=Uint8Array.from(atob(T.d),c=>c.charCodeAt(0)); createImageBitmap(new Blob([bin],{type:T.t}),{premultiplyAlpha:"none"}).then(img=>{
      gl.bindTexture(gl.TEXTURE_2D,t); gl.texImage2D(gl.TEXTURE_2D,0,srgb?gl.SRGB8_ALPHA8:gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,img); gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR); const af=gl.getExtension("EXT_texture_filter_anisotropic"); if(af) gl.texParameterf(gl.TEXTURE_2D,af.TEXTURE_MAX_ANISOTROPY_EXT,4); }).catch(()=>{}); }
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    return C[key]=t; }

  // placement des éléments selon le décor (mêmes ambiances, objets plus beaux)
  R4.kitPlacements=function(th,hgt){
    const L=[]; let seed=1; const rnd=()=>hash(seed++*1.618+.37);
    const put=(n,r0,r1,s0,s1,cnt,filter)=>{ for(let i=0;i<cnt;i++){ const a=rnd()*Math.PI*2, r=r0+rnd()*(r1-r0); const x=Math.sin(a)*r, z=Math.cos(a)*r;
      if(filter&&!filter(x,z,a,r)) continue; const nm=Array.isArray(n)?n[Math.floor(rnd()*n.length)]:n; L.push({n:nm,t:[x,hgt?hgt(x,z)-.05:0,z],ry:rnd()*Math.PI*2,s:s0+rnd()*(s1-s0)}); } };
    const PINES=["Pine_1","Pine_2","Pine_3","Pine_4","Pine_5"], COMMON=["CommonTree_1","CommonTree_2","CommonTree_3","CommonTree_4","CommonTree_5"], DEAD=["DeadTree_1","DeadTree_2","DeadTree_3"];
    if(th==="forest"){
      put(PINES,12,44,.9,1.35,55); put(COMMON,12,40,.8,1.15,45); put(DEAD,14,40,.45,.65,8); put(["TwistedTree_1","TwistedTree_3"],26,45,.45,.6,6);
      put(["Bush_Common","Bush_Common_Flowers"],9,15,.45,.75,30); put("Fern_1",7.5,15,.2,.3,26); put(["Plant_1_Big","Plant_1"],8,14,.3,.45,14);
      put(["Flower_3_Group","Flower_4_Group"],6.8,12,.22,.32,22); put(["Mushroom_Common","Mushroom_Laetiporus"],8.5,15,.45,.8,14);
      put(["Grass_Common_Short","Grass_Common_Tall","Grass_Wispy_Short"],6.8,15,.28,.42,90); put("Clover_1",6.8,11,.3,.45,16);
      put(["Rock_Medium_1","Rock_Medium_2","Rock_Medium_3"],7.5,13,.35,.8,10); put(["Pebble_Round_1","Pebble_Round_2"],2,6.5,.5,.9,12);
    } else if(th==="camp"){
      put(PINES,16,48,.95,1.45,70); put(DEAD,16,40,.5,.7,14); put(COMMON,20,44,.8,1.1,10);
      put(["Bush_Common"],10,17,.45,.7,14); put("Fern_1",9,16,.2,.28,12); put(["Grass_Wispy_Short","Grass_Common_Short"],6.8,16,.28,.4,60);
      put(["Rock_Medium_1","Rock_Medium_2","Rock_Medium_3"],7.5,15,.4,1,14); put(["Pebble_Round_1","Pebble_Round_2"],2,6.5,.5,.9,10);
      put(["Mushroom_Common"],9,15,.4,.7,8);
    } else if(th==="winter"){
      put(PINES,11.5,42,.9,1.35,95); put(DEAD,13,40,.45,.65,16);
      put(["Rock_Medium_1","Rock_Medium_2","Rock_Medium_3"],7,13,.35,.8,12); put(["Bush_Common"],9,14,.4,.6,10);
    } else if(th==="village"){
      put(COMMON,28,50,.8,1.15,40); put(PINES,30,52,.9,1.3,40);
      put(["Bush_Common","Bush_Common_Flowers"],13,16.5,.4,.6,22,(x,z,a)=>true); put(["Flower_3_Group","Flower_4_Group"],13,16,.2,.3,20);
      put(["Grass_Common_Short","Grass_Wispy_Short"],13,24,.25,.38,40);
    }
    return L;
  };
  R4.KIT_VS=`#version 300 es
  layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec2 aUV; layout(location=3) in vec3 aC;
  uniform mat4 uVP; uniform float uTime,uWind,uMat;
  out vec3 vW; out vec3 vN; out vec4 vC; out vec2 vUV;
  void main(){ vec3 w=aP; if(uMat>12.5){ float h=max(aP.y-.3,0.); float s=sin(uTime*1.3+aP.x*.21+aP.z*.17)+.4*sin(uTime*2.9+aP.z*.5);
      w.x+=s*.012*h*uWind; w.z+=cos(uTime*1.05+aP.x*.27)*.009*h*uWind; }
    vW=w; vN=aN; vC=vec4(aC,uMat); vUV=aUV; gl_Position=uVP*vec4(w,1.); }`;
})();
