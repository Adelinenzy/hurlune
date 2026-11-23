/* ===================== 3D VILLAGE (custom WebGL renderer, no dependency) ===================== */
const V3 = (function(){
  "use strict";
  /* ---------- small math ---------- */
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], scl=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const nrm=a=>{ const l=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/l,a[1]/l,a[2]/l]; };
  const lerp=(a,b,t)=>a+(b-a)*t, lerp3=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function mul(a,b){ const o=new Float32Array(16); for(let i=0;i<4;i++)for(let j=0;j<4;j++){ let s=0; for(let k=0;k<4;k++) s+=a[k*4+j]*b[i*4+k]; o[i*4+j]=s; } return o; }
  function persp(fov,asp,n,f){ const t=1/Math.tan(fov/2), nf=1/(n-f); return new Float32Array([t/asp,0,0,0, 0,t,0,0, 0,0,(f+n)*nf,-1, 0,0,2*f*n*nf,0]); }
  function lookAt(e,c,u){ const z=nrm(sub(e,c)), x=nrm(cross(u,z)), y=cross(z,x); return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,e),-dot(y,e),-dot(z,e),1]); }
  function model(tx,ty,tz,ry=0,rx=0,s=1,sy){ sy=sy==null?s:sy;
    const cy=Math.cos(ry),syy=Math.sin(ry),cx=Math.cos(rx),sx=Math.sin(rx);
    // M = T * Ry * Rx * S
    return new Float32Array([ cy*s,0,-syy*s,0,  syy*sx*sy,cx*sy,cy*sx*sy,0,  syy*cx*s,-sx*s,cy*cx*s,0,  tx,ty,tz,1 ]);
  }
  function hash(n){ const x=Math.sin(n*127.1+311.7)*43758.5453; return x-Math.floor(x); }
  function hexc(h){ const n=parseInt(h.slice(1),16); return [(n>>16)/255,((n>>8)&255)/255,(n&255)/255]; }
  const jit=(c,a,seed)=>c.map((v,i)=>clamp(v+(hash(seed*3.1+i)-.5)*a,0,1));

  /* ---------- geometry builder: interleaved [p3 n3 c4] ---------- */
  class Geo{
    constructor(){ this.a=[]; }
    _x(o){ // o: {t,r:[rx,ry,rz],s}
      const t=o.t||[0,0,0], r=o.r||[0,0,0], s=o.s||[1,1,1];
      const [ax,ay,az]=r, cx=Math.cos(ax),sx=Math.sin(ax),cy=Math.cos(ay),sy=Math.sin(ay),cz=Math.cos(az),sz=Math.sin(az);
      const rot=v=>{ let [x,y,z]=v; let x1=x*cz-y*sz, y1=x*sz+y*cz; x=x1; y=y1; // Rz
        let y2=y*cx-z*sx, z2=y*sx+z*cx; y=y2; z=z2; // Rx
        let x3=x*cy+z*sy, z3=-x*sy+z*cy; return [x3,y,z3]; }; // Ry
      return { p:v=>add(rot([v[0]*s[0],v[1]*s[1],v[2]*s[2]]),t), n:v=>nrm(rot([v[0]/s[0],v[1]/s[1],v[2]/s[2]])) };
    }
    tri(X,p0,p1,p2,n0,n1,n2,c,e){ for(const [p,n] of [[p0,n0],[p1,n1],[p2,n2]]){ const P=X.p(p),N=X.n(n); this.a.push(P[0],P[1],P[2],N[0],N[1],N[2],c[0],c[1],c[2],e); } }
    quad(X,a,b,c2,d,n,c,e){ this.tri(X,a,b,c2,n,n,n,c,e); this.tri(X,a,c2,d,n,n,n,c,e); }
    box(o,c,e=0){ const X=this._x(o); const h=.5;
      const F=[[[0,0,1],[-h,-h,h],[h,-h,h],[h,h,h],[-h,h,h]],[[0,0,-1],[h,-h,-h],[-h,-h,-h],[-h,h,-h],[h,h,-h]],[[1,0,0],[h,-h,h],[h,-h,-h],[h,h,-h],[h,h,h]],[[-1,0,0],[-h,-h,-h],[-h,-h,h],[-h,h,h],[-h,h,-h]],[[0,1,0],[-h,h,h],[h,h,h],[h,h,-h],[-h,h,-h]],[[0,-1,0],[-h,-h,-h],[h,-h,-h],[h,-h,h],[-h,-h,h]]];
      for(const [n,a,b,c2,d] of F) this.quad(X,a,b,c2,d,n,c,e); return this; }
    cyl(o,rt,rb,h,seg,c,e=0,smooth=false,caps=true){ const X=this._x(o);
      for(let i=0;i<seg;i++){ const a0=i/seg*Math.PI*2,a1=(i+1)/seg*Math.PI*2;
        const b0=[Math.sin(a0)*rb,0,Math.cos(a0)*rb],b1=[Math.sin(a1)*rb,0,Math.cos(a1)*rb],t0=[Math.sin(a0)*rt,h,Math.cos(a0)*rt],t1=[Math.sin(a1)*rt,h,Math.cos(a1)*rt];
        const sl=(rb-rt)/h; const nA=nrm([Math.sin(a0),sl,Math.cos(a0)]),nB=nrm([Math.sin(a1),sl,Math.cos(a1)]),am=(a0+a1)/2,nM=nrm([Math.sin(am),sl,Math.cos(am)]);
        if(smooth){ this.tri(X,b0,b1,t1,nA,nB,nB,c,e); if(rt>0) this.tri(X,b0,t1,t0,nA,nB,nA,c,e); }
        else { this.tri(X,b0,b1,t1,nM,nM,nM,c,e); if(rt>0) this.tri(X,b0,t1,t0,nM,nM,nM,c,e); }
        if(caps){ if(rt>0) this.tri(X,[0,h,0],t0,t1,[0,1,0],[0,1,0],[0,1,0],c,e); this.tri(X,[0,0,0],b1,b0,[0,-1,0],[0,-1,0],[0,-1,0],c,e); }
      } return this; }
    sph(o,r,ws,hs,c,e=0,flat=false){ const X=this._x(o);
      const P=(i,j)=>{ const th=j/hs*Math.PI, ph=i/ws*Math.PI*2; return [Math.sin(th)*Math.sin(ph)*r,Math.cos(th)*r,Math.sin(th)*Math.cos(ph)*r]; };
      for(let j=0;j<hs;j++) for(let i=0;i<ws;i++){ const a=P(i,j),b=P(i,j+1),c2=P(i+1,j+1),d=P(i+1,j);
        if(flat){ const n=nrm(cross(sub(b,a),sub(c2,a))); const nn=dot(n,a)<0?scl(n,-1):n; if(j>0) this.tri(X,a,b,c2,nn,nn,nn,c,e); if(j<hs-1) this.tri(X,a,c2,d,nn,nn,nn,c,e); }
        else { if(j>0) this.tri(X,a,b,c2,nrm(a),nrm(b),nrm(c2),c,e); if(j<hs-1) this.tri(X,a,c2,d,nrm(a),nrm(c2),nrm(d),c,e); } }
      return this; }
    ring(o,ri,ro,seg,c,e=0){ const X=this._x(o); const up=[0,1,0];
      for(let i=0;i<seg;i++){ const a0=i/seg*Math.PI*2,a1=(i+1)/seg*Math.PI*2; const p=(a,r)=>[Math.sin(a)*r,0,Math.cos(a)*r];
        this.quad(X,p(a0,ri),p(a0,ro),p(a1,ro),p(a1,ri),up,c,e); } return this; }
    prism(o,c,e=0){ // roof: unit, ridge along x, height 1, base y=0 width z 1
      const X=this._x(o); const h=.5;
      const A=[-h,0,h],B=[h,0,h],C=[h,1,0],D=[-h,1,0],E=[-h,0,-h],F=[h,0,-h];
      this.quad(X,A,B,C,D,nrm([0,.5,1]),c,e); this.quad(X,F,E,D,C,nrm([0,.5,-1]),c,e);
      this.tri(X,B,F,C,[1,0,0],[1,0,0],[1,0,0],shade(c,.85),e); this.tri(X,E,A,D,[-1,0,0],[-1,0,0],[-1,0,0],shade(c,.85),e); return this; }
    upload(gl){ const d=new Float32Array(this.a); const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW); return {b,n:d.length/10}; }
  }
  const shade=(c,f)=>[c[0]*f,c[1]*f,c[2]*f];

  /* ---------- shaders ---------- */
  const VS=`attribute vec3 aP;attribute vec3 aN;attribute vec4 aC;uniform mat4 uVP,uM;varying vec3 vW,vN;varying vec4 vC;
  void main(){vec4 w=uM*vec4(aP,1.);vW=w.xyz;vN=mat3(uM)*aN;vC=aC;gl_Position=uVP*w;}`;
  const FS=`precision mediump float;varying vec3 vW,vN;varying vec4 vC;
  uniform vec3 uSunDir,uSunCol,uSkyAmb,uGndAmb,uFogCol,uCam,uFireP,uFireC,uLampC,uHiCol,uTint;uniform vec3 uLampP[6];
  uniform float uFogD,uEm,uHi,uAlpha,uNoFog,uWin,uTime;
  void main(){if(uNoFog<.5&&vW.y>.06&&length(uCam.xz-vW.xz)<3.4)discard;vec3 n=normalize(vN);vec3 base=vC.rgb*uTint;
   float ndl=max(dot(n,uSunDir),0.);float toon=ndl>.55?1.:ndl>.22?.62:ndl>.02?.32:0.;
   vec3 lit=mix(uGndAmb,uSkyAmb,n.y*.5+.5)+uSunCol*toon;
   vec3 L=uFireP-vW;float d=length(L);float fd=dot(n,L/d);float ft=fd>.35?1.:fd>0.?.6:.25;lit+=uFireC*ft/(1.+.11*d*d+.002*d*d*d*d);
   for(int i=0;i<6;i++){vec3 l=uLampP[i]-vW;float dd=length(l);lit+=uLampC*(max(dot(n,l/dd),0.)*.6+.4)/(1.+.55*dd*dd);}
   float em=vC.a<.5?0.:(vC.a<1.5?uWin:1.);
   vec3 col=base*lit+base*em*1.7+base*uEm;
   vec3 V=normalize(uCam-vW);float rim=pow(1.-max(dot(n,V),0.),2.5);
   col+=uHiCol*uHi*(rim*1.6+.12);
   float dist=length(uCam-vW);float fog=uNoFog>.5?0.:1.-exp(-pow(uFogD*dist,1.6));
   fog*=1.-em*.45; fog=clamp(fog+(vW.y<1.5?0.:0.),0.,1.);
   gl_FragColor=vec4(mix(col,uFogCol,fog),uAlpha);}`;
  const SKY_VS=`attribute vec2 aP;uniform vec3 uR,uU,uF;uniform float uTH,uAsp;varying vec3 vR;void main(){vR=uF+aP.x*uAsp*uTH*uR+aP.y*uTH*uU;gl_Position=vec4(aP,.9999,1.);}`;
  const SKY_FS=`precision mediump float;varying vec3 vR;uniform vec3 uTop,uHor,uFogCol,uMoonDir,uSunDir,uMoonCol,uSunCol;uniform float uStars,uTime;
  float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  void main(){vec3 r=normalize(vR);float h=r.y;vec3 col=mix(uHor,uTop,smoothstep(-.02,.55,h));
   if(h>0.){vec3 q=floor(r*220.);float s=h3(q);if(s>.9965){float tw=.6+.4*sin(uTime*2.+s*90.);col+=vec3(.9,.92,1.)*uStars*(s-.9965)*280.*tw*smoothstep(0.,.25,h);}}
   float md=dot(r,uMoonDir);float disc=smoothstep(.9988,.99905,md);vec3 m=uMoonCol*(.82+.18*h3(floor(r*90.)));
   col=mix(col,m,disc*length(uMoonCol)/1.4);col+=uMoonCol*pow(max(md,0.),400.)*.9+uMoonCol*pow(max(md,0.),20.)*.08;
   float sd=dot(r,uSunDir);col+=uSunCol*(smoothstep(.9975,.999,sd)+pow(max(sd,0.),60.)*.35);
   col=mix(uFogCol,col,smoothstep(-.03,.18,h));gl_FragColor=vec4(col,1.);}`;
  const PT_VS=`attribute vec3 aP;attribute float aS;attribute vec4 aC;uniform mat4 uVP;uniform float uScale;varying vec4 vC;
  void main(){gl_Position=uVP*vec4(aP,1.);gl_PointSize=clamp(aS*uScale/gl_Position.w,1.,160.);vC=aC;}`;
  const PT_FS=`precision mediump float;varying vec4 vC;uniform float uAdd;void main(){vec2 c=gl_PointCoord-.5;float d=length(c);float a=smoothstep(.5,.05,d);
   if(uAdd>.5) gl_FragColor=vec4(vC.rgb*a*vC.a,1.); else gl_FragColor=vec4(vC.rgb,a*vC.a);}`;

  function prog(gl,vs,fs){ const sh=(t,s)=>{ const o=gl.createShader(t); gl.shaderSource(o,s); gl.compileShader(o); if(!gl.getShaderParameter(o,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p=gl.createProgram(); gl.attachShader(p,sh(gl.VERTEX_SHADER,vs)); gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u={},a={}; const nu=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS); for(let i=0;i<nu;i++){ const n=gl.getActiveUniform(p,i).name.replace("[0]",""); u[n]=gl.getUniformLocation(p,n); }
    const na=gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES); for(let i=0;i<na;i++){ const n=gl.getActiveAttrib(p,i).name; a[n]=gl.getAttribLocation(p,n); }
    return {p,u,a}; }

  /* ---------- palettes ---------- */
  const PAL={
    day:  {top:[.32,.58,.9],hor:[.97,.86,.7],fog:[.78,.82,.86],fogD:.011,sunDir:nrm([.45,.75,.35]),sunCol:[1.05,.95,.82],sky:[.55,.6,.72],gnd:[.36,.3,.24],fire:[.7,.35,.12],lamp:[0,0,0],win:0,stars:0,moon:[0,0,0],sun:[1.4,1.2,.8],mist:0,eyes:0,ff:0,vig:.15},
    dusk: {top:[.12,.1,.28],hor:[.95,.48,.32],fog:[.4,.26,.3],fogD:.02,sunDir:nrm([-.7,.22,-.5]),sunCol:[.95,.55,.35],sky:[.3,.24,.36],gnd:[.14,.1,.1],fire:[1.5,.75,.3],lamp:[.9,.5,.2],win:.9,stars:.35,moon:[0,0,0],sun:[1.2,.5,.25],mist:.15,eyes:0,ff:.6,vig:.3},
    night:{top:[.008,.012,.035],hor:[.05,.07,.15],fog:[.03,.04,.085],fogD:.042,sunDir:nrm([-.35,.85,-.45]),sunCol:[.2,.27,.45],sky:[.05,.07,.13],gnd:[.015,.015,.03],fire:[1.7,.72,.26],lamp:[.95,.5,.18],win:1,stars:1,moon:[1.25,1.25,1.35],sun:[0,0,0],mist:.55,eyes:.6,ff:.35,vig:.55},
    wolves:{top:[.02,.005,.01],hor:[.16,.03,.04],fog:[.08,.015,.02],fogD:.05,sunDir:nrm([-.35,.85,-.45]),sunCol:[.3,.08,.08],sky:[.07,.03,.04],gnd:[.02,.0,.0],fire:[1.25,.38,.12],lamp:[.6,.18,.08],win:.55,stars:.6,moon:[1.4,.75,.6],sun:[0,0,0],mist:.8,eyes:1,ff:0,vig:.75}
  };

  /* ---------- state ---------- */
  let gl,cv,P,SP,PP,stat,meshes={},chars={},players=[],votes={},mood="dusk",cur=clone(PAL.dusk),target=PAL.dusk,me=null,ok=false,raf=0,T0=performance.now(),labelsEl=null;
  let camAng=0,camDrag=0,dragging=false,dragX=0,zoom=1,hoverId=null,onPick=null,isClickable=()=>false,lastT=0;
  const parts=[],sparks=[]; let ptBuf=null,ptData=new Float32Array(0),eyes=[];
  let LAMPS=[], theme="village", paused=false;
  function computeLamps(th){ LAMPS=[]; for(let i=0;i<6;i++){ const a=i/6*Math.PI*2+.26; LAMPS.push(th==="forest"?[Math.sin(a)*10.6,2.75,Math.cos(a)*10.6]:[Math.sin(a)*11.2,2.35,Math.cos(a)*11.2]); } }
  computeLamps("village");
  function themed(m){ const p=clone(PAL[m]||PAL.dusk);
    if(theme==="winter"){ const w=m==="day"?[.86,.9,.96]:null; if(w){ p.fog=w; p.hor=[.92,.94,1]; p.top=[.5,.66,.88]; p.sky=[.7,.74,.85]; p.gnd=[.5,.52,.58]; }
      else { p.fog=lerp3(p.fog,[.12,.14,.2],.5); p.gnd=lerp3(p.gnd,[.05,.06,.1],.6); } }
    if(theme==="forest"){ p.fog=lerp3(p.fog,[.05,.09,.06],m==="day"?.25:.55); p.fogD*=1.15; p.ff=Math.max(p.ff,m==="day"?.15:.9); if(m==="day"){ p.top=[.35,.55,.7]; p.sunCol=[.85,.9,.7]; } }
    return p; }

  function buildStatic(th){
    const g=new Geo(); const W=th==="winter", FO=th==="forest";
    const snowy=(c,k=.75)=>W?lerp3(c,[.9,.93,.98],k):c;
    // ground (grid)
    const N=90,S=120;
    for(let i=0;i<N;i++) for(let j=0;j<N;j++){
      const x0=-S/2+i*S/N,z0=-S/2+j*S/N,x1=x0+S/N,z1=z0+S/N;
      const hgt=(x,z)=>{ const r=Math.hypot(x,z); return r<20?0:(Math.sin(x*.21)*Math.cos(z*.17)+Math.sin(x*.07+z*.05)*1.5)*.4*Math.min(1,(r-20)/10); };
      const cx=(x0+x1)/2,cz=(z0+z1)/2,r=Math.hypot(cx,cz);
      const nz=(Math.sin(cx*1.7)*Math.cos(cz*1.3)+Math.sin(cx*.5+cz*.8))*.5;
      let c;
      if(FO){ const bl=clamp((r-9.5)/3,0,1); c=lerp3([.29+nz*.03,.23+nz*.025,.16+nz*.02],[.13+nz*.03,.24+nz*.05,.12+nz*.02],bl); if(r<1.7) c=[.15,.12,.1]; }
      else if(r<12.5){ const k=hash(i*131+j*17)*.035; c=[.37+nz*.03+k,.34+nz*.025+k,.31+nz*.02+k]; if(r<1.7) c=[.15,.12,.1]; if(W&&r>1.7) c=lerp3(c,[.88,.9,.96],.45+.3*hash(i*7+j)); }
      else if(r<13.7) c=snowy([.36,.31,.24],.6);
      else { c=snowy([.2+nz*.03,.33+nz*.05,.17+nz*.02],.92); }
      const p=[[x0,hgt(x0,z0),z0],[x1,hgt(x1,z0),z0],[x1,hgt(x1,z1),z1],[x0,hgt(x0,z1),z1]];
      const n=nrm(cross(sub(p[3],p[0]),sub(p[1],p[0])));
      const X={p:v=>v,n:v=>v};
      g.tri(X,p[0],p[3],p[2],n,n,n,c,0); g.tri(X,p[0],p[2],p[1],n,n,n,c,0);
    }
    if(!FO){ let id=0; for(let r=2.1;r<12.2;r+=.62){ const n=Math.floor(2*Math.PI*r/.66); const off=hash(r)*6;
        for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+off; const sh=.92+hash(id*1.3)*.16; g.box({t:[Math.sin(a)*r,.012,Math.cos(a)*r],r:[0,a,0],s:[.56,.04,.5]},W?(hash(id*.7)>.25?[.88*sh,.9*sh,.95*sh]:[.6*sh,.6*sh,.63*sh]):[.4*sh,.37*sh,.33*sh],0); id++; } } }
    // path stones ring
    if(!FO) for(let i=0;i<46;i++){ const a=i/46*Math.PI*2; g.cyl({t:[Math.sin(a)*12.6,0,Math.cos(a)*12.6]},.32,.36,.06,6,jit([.5,.46,.4],.08,i),0); }
    // campfire
    g.cyl({t:[0,0,0]},1.2,1.25,.03,16,[.12,.1,.09],0);
    for(let i=0;i<11;i++){ const a=i/11*Math.PI*2; g.sph({t:[Math.sin(a)*1.05,.12,Math.cos(a)*1.05],s:[1,.75,1]},.24,6,4,jit([.45,.43,.42],.1,i),0,true); }
    for(let i=0;i<5;i++){ const a=i/5*Math.PI*2; g.cyl({t:[Math.sin(a)*.55,.12,Math.cos(a)*.55],r:[1.25,a,0]},.09,.11,1.05,7,[.34,.2,.11],0); }
    g.sph({t:[0,.08,0],s:[1,.35,1]},.45,8,4,[1,.45,.12],2);
    // houses
    const roofC=[[.55,.2,.15],[.38,.24,.18],[.3,.32,.4],[.5,.28,.15],[.45,.18,.2]], wallC=[[.86,.78,.62],[.8,.7,.52],[.88,.83,.72],[.74,.63,.48]];
    const houses=[0,1,2,3,4,6,7,8,9,10];
    if(!FO) houses.forEach((k,idx)=>{
      const a=k/11*Math.PI*2+.1, r=17+hash(k)*2.5, x=Math.sin(a)*r, z=Math.cos(a)*r, ry=a+Math.PI;
      const w=3.2+hash(k+1)*1.4, d=3, hh=2.6+hash(k+2)*1.3, wc=wallC[k%4], rc=roofC[k%5], tc=[.24,.15,.1];
      const loc=(lx,ly,lz)=>{ const c=Math.cos(ry),s=Math.sin(ry); return [x+lx*c+lz*s,ly,z-lx*s+lz*c]; };
      g.box({t:loc(0,hh/2,0),r:[0,ry,0],s:[w,hh,d]},wc,0);
      g.box({t:loc(0,.25,0),r:[0,ry,0],s:[w+.1,.5,d+.1]},[.4,.38,.36],0);
      // timber
      for(const lx of [-w/2,w/2,0]) g.box({t:loc(lx,hh/2,d/2+.02),r:[0,ry,0],s:[.14,hh,.06]},tc,0);
      g.box({t:loc(0,hh-.08,d/2+.02),r:[0,ry,0],s:[w,.16,.06]},tc,0); g.box({t:loc(0,hh*.52,d/2+.02),r:[0,ry,0],s:[w,.12,.06]},tc,0);
      // door + windows (front faces +z local -> toward plaza)
      g.box({t:loc(-w*.22,.75,d/2+.03),r:[0,ry,0],s:[.7,1.5,.08]},[.28,.17,.1],0);
      g.box({t:loc(w*.25,hh*.42+.35,d/2+.03),r:[0,ry,0],s:[.6,.55,.08]},[1,.72,.32],1);
      if(hh>3.1) g.box({t:loc(-w*.22,hh*.78,d/2+.03),r:[0,ry,0],s:[.5,.45,.08]},[1,.7,.3],1);
      g.box({t:loc(w*.3,hh*.4,-d/2-.03),r:[0,ry,0],s:[.5,.45,.08]},[1,.7,.3],1);
      // roof
      const rh=1.6+hash(k)*.6; g.prism({t:loc(0,hh,0),r:[0,ry,0],s:[w+.6,rh,d+.7]},rc,0);
      if(W) g.prism({t:loc(0,hh+.06,0),r:[0,ry,0],s:[w+.7,rh+.08,d+.8]},[.93,.95,1],0);
      g.box({t:loc(w*.28,hh+1.2,-.4),r:[0,ry,0],s:[.45,1.3,.45]},[.45,.3,.25],0);
      // props
      if(hash(k+5)>.4) g.cyl({t:loc(w/2+.5,0,d/2+.4)},.35,.4,.85,8,[.45,.28,.14],0);
      if(hash(k+6)>.5) g.box({t:loc(-w/2-.4,.35,d/2+.3),r:[0,ry+.3,0],s:[.7,.7,.7]},[.55,.4,.22],0);
    });
    // church tower
    if(!FO){ const a=5/11*Math.PI*2+.1, r=21, x=Math.sin(a)*r, z=Math.cos(a)*r, ry=a+Math.PI;
      g.box({t:[x,3,z],r:[0,ry,0],s:[4,6,5]},[.7,.68,.64],0); g.prism({t:[x,6,z],r:[0,ry+Math.PI/2,0],s:[5.6,2.4,4.6]},[.3,.3,.36],0);
      g.box({t:[x,5,z],r:[0,ry,0],s:[2,10,2]},[.72,.7,.66],0); g.cyl({t:[x,10,z]},0,1.6,4,4,[.28,.28,.34],0);
      const fx=x-Math.sin(ry)*-1.02, fz=z-Math.cos(ry)*-1.02;
      g.box({t:[x+Math.sin(a+Math.PI)*1.02,8.2,z+Math.cos(a+Math.PI)*1.02],r:[0,ry,0],s:[.8,1.1,.1]},[1,.75,.35],1);
      g.cyl({t:[x,14,z]},.05,.05,1,4,[.8,.7,.3],0); g.box({t:[x,14.65,z],r:[0,ry,0],s:[.6,.08,.08]},[.8,.7,.3],0); }
    // well
    if(!FO){ g.cyl({t:[7.6,0,-6.2]},.95,1,.85,12,[.5,.48,.45],0); g.cyl({t:[7.6,.86,-6.2]},.7,.7,.02,12,[.08,.12,.18],0);
    for(const s of [-1,1]) g.box({t:[7.6+s*.85,1.4,-6.2],s:[.12,1.9,.12]},[.35,.22,.12],0);
    g.prism({t:[7.6,2.3,-6.2],s:[2.2,.8,1.6]},W?[.92,.94,1]:[.4,.22,.15],0); }
    // lantern posts
    if(!FO) for(const L of LAMPS){ g.cyl({t:[L[0],0,L[2]]},.07,.09,2.2,6,[.15,.13,.12],0); g.box({t:[L[0],2.35,L[2]],s:[.3,.36,.3]},[1,.62,.25],2); g.cyl({t:[L[0],2.53,L[2]]},0,.24,.25,4,[.15,.13,.12],0); }
    // fences
    if(!FO) for(let i=0;i<60;i++){ const a=i/60*Math.PI*2; if(Math.abs(Math.sin(a*5.5))>.92) continue; const r=25; g.box({t:[Math.sin(a)*r,.45,Math.cos(a)*r],r:[0,a,0],s:[.1,.9,.1]},[.36,.25,.15],0); g.box({t:[Math.sin(a)*r,.6,Math.cos(a)*r],r:[0,a+Math.PI/2,0],s:[.06,.08,2.7]},[.4,.28,.17],0); }
    // trees
    const NT=FO?240:130;
    for(let i=0;i<NT;i++){ const a=hash(i*3.7)*Math.PI*2, r=(FO?13.5:27)+hash(i*5.1)*(FO?34:24), x=Math.sin(a)*r, z=Math.cos(a)*r, s=(FO?1.1:.9)+hash(i*7.3)*1.3;
      const gc=W?lerp3(jit([.09,.2,.12],.05,i),[.85,.9,.95],.35):jit(FO?[.06,.16,.1]:[.09,.2,.12],.05,i);
      g.cyl({t:[x,0,z],s:[s,s,s]},.18,.26,1.2,6,[.22,.14,.09],0);
      g.cyl({t:[x,1,z],s:[s,s,s]},0,1.5,2.2,7,gc,0); g.cyl({t:[x,2,z],s:[s,s,s]},0,1.15,1.9,7,shade(gc,1.15),0); g.cyl({t:[x,2.9,z],s:[s,s,s]},0,.75,1.6,7,shade(gc,1.3),0); }
    for(let i=0;i<40;i++){ const a=hash(i*9.1)*Math.PI*2, r=14.5+hash(i*2.3)*9; if(r<23&&r>13.5&&hash(i)>.5) g.sph({t:[Math.sin(a)*r,.2,Math.cos(a)*r],s:[1.3,.8,1.1]},.6,6,4,W?[.85,.88,.95]:jit([.18,.32,.16],.06,i),0,true); }
    if(FO){
      // standing stones with torches
      for(let i=0;i<10;i++){ const a=i/10*Math.PI*2+.1, r=10.6, h=2.2+hash(i*3)*1.4;
        g.box({t:[Math.sin(a)*r,h/2,Math.cos(a)*r],r:[hash(i)*.12,a,hash(i*2)*.1],s:[.9,h,.6]},jit([.42,.43,.45],.05,i),0);
        g.box({t:[Math.sin(a)*r,h*.35,Math.cos(a)*r],r:[0,a,0],s:[.94,.5,.64]},[.2,.32,.16],0); }
      for(const L of LAMPS){ g.cyl({t:[L[0],0,L[2]]},.05,.07,2.6,5,[.25,.17,.1],0); g.sph({t:[L[0],2.72,L[2]],s:[1,1.4,1]},.13,6,4,[1,.6,.2],2); }
      // fallen logs & glowing mushrooms
      for(let i=0;i<7;i++){ const a=hash(i*11.1)*Math.PI*2, r=12.6+hash(i*4.4)*3; g.cyl({t:[Math.sin(a)*r,.22,Math.cos(a)*r],r:[Math.PI/2,a+1.2,0]},.24,.28,2.4,7,[.3,.2,.12],0); }
      for(let i=0;i<70;i++){ const a=hash(i*5.9)*Math.PI*2, r=8+hash(i*1.9)*12; if(Math.abs(r-10.6)<.8) continue; const x=Math.sin(a)*r,z=Math.cos(a)*r, c=[[.95,.25,.3],[.45,.8,1],[.7,.5,1]][i%3];
        g.cyl({t:[x,0,z]},.03,.04,.16,5,[.9,.88,.8],0); g.sph({t:[x,.17,z],s:[1,.55,1]},.09,6,4,c,1); }
      // ruined arch
      { const a=2.4, r=15, x=Math.sin(a)*r, z=Math.cos(a)*r; for(const s of [-1,1]) g.box({t:[x+Math.cos(a)*s*1.6,1.8,z-Math.sin(a)*s*1.6],r:[0,a,0],s:[.7,3.6,.7]},[.45,.45,.47],0); g.box({t:[x,3.8,z],r:[0,a,.08],s:[4,.6,.8]},[.45,.45,.47],0); }
    }
    // mountains
    for(let i=0;i<14;i++){ const a=i/14*Math.PI*2+hash(i)*.3, r=85+hash(i*2)*25; g.cyl({t:[Math.sin(a)*r*1.4,-2,Math.cos(a)*r*1.4]},0,30+hash(i*3)*18,30+hash(i*4)*26,7,W?[.7,.74,.82]:[.16,.18,.24],0); }
    return g.upload(gl);
  }

  /* ---------- characters ---------- */
  function buildChar(av){
    const sk=hexc(SKIN[av.s%SKIN.length]), hc=hexc(HAIRC[av.hc%HAIRC.length]), tc=hexc(TOPC[av.t%TOPC.length]), tcd=shade(tc,.7);
    const b=new Geo(), h=new Geo();
    // stool
    b.cyl({t:[0,0,-.05]},.3,.24,.46,10,[.42,.27,.15],0);
    // legs
    const pants=[.17,.15,.2];
    for(const s of [-1,1]){ b.box({t:[s*.11,.53,.15],s:[.15,.14,.44]},pants,0); b.box({t:[s*.11,.27,.36],s:[.13,.48,.13]},pants,0); b.box({t:[s*.11,.04,.42],s:[.15,.08,.24]},[.1,.08,.08],0); }
    const o=av.o%4;
    if(o===1){ b.cyl({t:[0,.12,.05]},.26,.48,.5,12,tc,0); }
    b.cyl({t:[0,.5,0]},.22,.3,.62,12,tc,0,true);
    b.cyl({t:[0,.5,0],r:[0,Math.PI/2,0]},.221,.301,.62,12,tc,0,true,false);
    if(o===0){ b.box({t:[0,.82,.255],r:[-.13,0,0],s:[.07,.55,.04]},[.92,.9,.85],0); for(const y of [.7,.85,1]) b.sph({t:[.06,y,.24+(1-y)*.05]},.025,4,3,[.85,.7,.3],0); }
    if(o===2){ b.cyl({t:[0,.68,0]},.3,.3,.08,12,[.33,.2,.1],0); b.box({t:[0,.72,.29],s:[.09,.09,.04]},[.85,.7,.3],0); }
    if(o===3){ b.cyl({t:[0,.35,-.06]},.3,.44,.82,12,tcd,0); }
    // arms (resting on knees)
    for(const s of [-1,1]){ b.cyl({t:[s*.27,1.02,0],r:[2.3,0,s*.12]},.075,.085,.6,7,o===3?tcd:tc,0); b.sph({t:[s*.22,.63,.42]},.07,6,4,sk,0); }
    b.cyl({t:[0,1.1,0]},.09,.1,.1,8,sk,0);
    // head (pivot at neck y=1.15)
    h.sph({t:[0,.3,0],s:[1,1.12,1]},.25,14,10,sk,0);
    h.sph({t:[0,.26,.245]},.045,6,4,shade(sk,.88),0);
    for(const s of [-1,1]){ h.sph({t:[s*.09,.33,.215],s:[1,1.25,.6]},.034,6,4,[.08,.06,.06],0); h.sph({t:[s*.15,.22,.18],s:[1,.6,.5]},.045,6,4,[1,.6,.6],0); }
    const cap=(sy=.72,ex=.012)=>h.sph({t:[0,.38,-.025],s:[1.04,sy,1.04]},.255+ex,12,7,hc,0);
    switch(av.h%6){
      case 0: cap(); break;
      case 1: cap(.85,.02); h.box({t:[0,.5,.17],r:[.3,0,0],s:[.42,.08,.12]},hc,0); break;
      case 2: cap(.8,.015); h.box({t:[0,.22,-.16],s:[.5,.55,.14]},hc,0); for(const s of [-1,1]) h.box({t:[s*.23,.2,.02],s:[.07,.42,.18]},hc,0); break;
      case 3: cap(.7); for(let i=0;i<6;i++){ const a=i/6*Math.PI*2; h.cyl({t:[Math.sin(a)*.12,.52,Math.cos(a)*.12-.03],r:[Math.cos(a)*.6,0,-Math.sin(a)*.6]},0,.07,.2,5,hc,0); } break;
      case 4: cap(); h.sph({t:[0,.62,-.1]},.11,8,6,hc,0); break;
      case 5: break;
    }
    switch(av.a%5){
      case 1: h.cyl({t:[0,.52,0]},.3,.3,.03,14,[.1,.09,.12],0); h.cyl({t:[0,.54,0]},.19,.2,.34,12,[.13,.12,.16],0); h.cyl({t:[0,.58,0]},.205,.205,.06,12,[.55,.15,.2],0); break;
      case 2: h.sph({t:[0,.33,-.09],s:[1.08,1.15,.95]},.3,12,8,shade(tc,.85),0); break;
      case 3: for(let i=0;i<7;i++){ const a=i/7*Math.PI*2; h.sph({t:[Math.sin(a)*.22,.53,Math.cos(a)*.22-.02]},.05,6,4,[[1,.55,.7],[1,.85,.35],[.6,.8,1]][i%3],0); } break;
      case 4: h.sph({t:[.03,.56,-.01],r:[0,0,.2],s:[1.15,.35,1.15]},.25,12,6,[.25,.18,.4],0); break;
    }
    return {b:b.upload(gl),h:h.upload(gl)};
  }
  function buildTomb(){ const g=new Geo();
    g.sph({t:[0,0,.2],s:[1.2,.35,1.5]},.5,10,5,[.25,.18,.12],0);
    g.box({t:[0,.45,-.1],s:[.62,.9,.18]},[.55,.56,.6],0); g.cyl({t:[0,.9,-.1],r:[Math.PI/2,0,0]},.31,.31,.18,10,[.55,.56,.6],0,false);
    g.box({t:[0,.62,.0],s:[.08,.36,.03]},[.32,.33,.37],0); g.box({t:[0,.68,.0],s:[.24,.07,.03]},[.32,.33,.37],0);
    for(let i=0;i<3;i++) g.sph({t:[-.2+i*.2,.12,.45]},.06,5,4,[[.9,.3,.4],[.95,.8,.3],[.7,.5,.95]][i],0);
    return g.upload(gl); }

  /* ---------- particles ---------- */
  function spawn(kind){
    if(kind==="fire") parts.push({k:0,p:[(Math.random()-.5)*.6,.15,(Math.random()-.5)*.6],v:[(Math.random()-.5)*.12,.8+Math.random()*.7,(Math.random()-.5)*.12],life:0,max:.55+Math.random()*.45,s:.6+Math.random()*.5});
    else if(kind==="ember") parts.push({k:1,p:[(Math.random()-.5)*.5,.4,(Math.random()-.5)*.5],v:[(Math.random()-.5)*.6,1.4+Math.random()*1.6,(Math.random()-.5)*.6],life:0,max:1.6+Math.random()*1.6,s:.05+Math.random()*.05});
    else if(kind==="smoke") parts.push({k:2,p:[(Math.random()-.5)*.3,1.6,(Math.random()-.5)*.3],v:[.15+Math.random()*.15,.7,(Math.random()-.5)*.1],life:0,max:4+Math.random()*2,s:.9+Math.random()*.7});
    else if(kind==="mist"){ const a=Math.random()*Math.PI*2,r=3+Math.random()*20; parts.push({k:3,p:[Math.sin(a)*r,.15+Math.random()*.5,Math.cos(a)*r],v:[.25+Math.random()*.2,0,(Math.random()-.5)*.2],life:0,max:9+Math.random()*6,s:3.5+Math.random()*3}); }
    else if(kind==="snow"){ const a=Math.random()*Math.PI*2,r=Math.random()*22; parts.push({k:5,p:[Math.sin(a)*r,9+Math.random()*3,Math.cos(a)*r],v:[(Math.random()-.5)*.3,-.7-Math.random()*.5,(Math.random()-.5)*.3],life:0,max:14,s:.06+Math.random()*.06,ph:Math.random()*9}); }
    else if(kind==="ff"){ const a=Math.random()*Math.PI*2,r=6+Math.random()*16; parts.push({k:4,p:[Math.sin(a)*r,.5+Math.random()*2,Math.cos(a)*r],v:[(Math.random()-.5)*.4,(Math.random()-.5)*.2,(Math.random()-.5)*.4],life:0,max:5+Math.random()*5,s:.09,ph:Math.random()*9}); }
  }
  function stepParts(dt,t){
    const P=cur;
    const fireAmt=clamp(length3(P.fire)/1.2,.4,1.3);
    for(let i=0;i<Math.round(75*dt*fireAmt*2.2+Math.random());i++) spawn("fire");
    if(Math.random()<dt*8) spawn("ember");
    if(Math.random()<dt*2.2) spawn("smoke");
    if(Math.random()<dt*P.mist*3) spawn("mist");
    if(Math.random()<dt*P.ff*6) spawn("ff");
    if(theme==="winter") for(let i=0;i<Math.round(dt*45+Math.random()*.6);i++) spawn("snow");
    for(let i=parts.length-1;i>=0;i--){ const q=parts[i]; q.life+=dt; if(q.life>q.max){ parts.splice(i,1); continue; }
      q.p[0]+=q.v[0]*dt; q.p[1]+=q.v[1]*dt; q.p[2]+=q.v[2]*dt;
      if(q.k===0){ q.v[0]+=(-q.p[0])*dt*2; q.v[2]+=(-q.p[2])*dt*2; }
      if(q.k===1){ q.v[0]+=Math.sin(t*3+i)*dt*.6; }
      if(q.k===5){ q.v[0]=Math.sin(t*.8+q.ph)*.35; if(q.p[1]<.02){ parts.splice(i,1); continue; } }
      if(q.k===4){ q.v[0]+=Math.sin(t*1.3+q.ph)*dt*.3; q.v[2]+=Math.cos(t*1.1+q.ph)*dt*.3; q.v[1]+=Math.sin(t*2+q.ph)*dt*.2; } }
    if(parts.length>1400) parts.splice(0,parts.length-1400);
  }
  const length3=a=>Math.hypot(a[0],a[1],a[2]);
  function fillParts(add){
    const P=cur, arr=[];
    for(const q of parts){ const f=q.life/q.max;
      if(add){
        if(q.k===0){ const c=f<.25?[1,.78,.38]:f<.55?[1,.45,.12]:[.75,.16,.05]; const a=(1-f)*.55; const fc=length3(P.fire)/1.9; arr.push(q.p[0],q.p[1],q.p[2],q.s*(1-f*.6),c[0]*fc,c[1]*fc,c[2]*fc,a); }
        else if(q.k===1){ arr.push(q.p[0],q.p[1],q.p[2],q.s,1,.6,.2,(1-f)); }
        else if(q.k===4){ const b=.5+.5*Math.sin(q.life*5+q.ph); arr.push(q.p[0],q.p[1],q.p[2],q.s,.95,1,.45,b*Math.sin(f*Math.PI)*P.ff*1.4); }
      } else {
        if(q.k===2){ const g=P.fog; arr.push(q.p[0],q.p[1],q.p[2],q.s*(.5+f*1.4),g[0]*.6+.12,g[1]*.6+.12,g[2]*.6+.13,(1-f)*.22*Math.min(1,f*3)); }
        else if(q.k===5){ const br=Math.min(1,length3(P.sky)*1.8+.35); arr.push(q.p[0],q.p[1],q.p[2],q.s,br,br,br*1.03,.85); }
        else if(q.k===3){ const g=P.fog; arr.push(q.p[0],q.p[1],q.p[2],q.s,g[0]*1.6+.08,g[1]*1.6+.08,g[2]*1.6+.1,Math.sin(f*Math.PI)*.38*P.mist); }
      }
    }
    if(add&&length3(P.lamp)>.05){ const li=length3(P.lamp)/1.1; for(const L of LAMPS) arr.push(L[0],L[1],L[2],1.6,1,.55,.2,.35*li); arr.push(0,1.2,0,3.2,1,.45,.12,.25*clamp(length3(P.fire)/1.8,0,1)); }
    if(add) for(const s of sparks){ arr.push(s.p[0],s.p[1],s.p[2],s.s,s.c[0],s.c[1],s.c[2],s.a); }
    return new Float32Array(arr);
  }
  function stepSparks(dt,t){
    sparks.length=0;
    for(const [v,tg] of Object.entries(votes)){ const A=chars[v],B=chars[tg]; if(!A||!B) continue;
      const a=[A.x,1.6,A.z], b=[B.x,1.5,B.z]; const col=A.wolf?[1,.25,.2]:[.75,.55,1];
      for(let k=0;k<7;k++){ const u=((t*.45+k/7+hash(v.length+k))%1); const h=Math.sin(u*Math.PI)*1.4;
        sparks.push({p:[lerp(a[0],b[0],u),lerp(a[1],b[1],u)+h,lerp(a[2],b[2],u)],s:.16+.1*Math.sin(u*Math.PI),c:col,a:.9*Math.sin(u*Math.PI)+.1}); } }
  }

  /* ---------- public API ---------- */
  function setTheme(th){ if(!ok||th===theme) return; theme=th; computeLamps(th); gl.deleteBuffer(stat.b); stat=buildStatic(th); target=themed(mood); cur=clone(target); parts.length=0; }
  function pause(b){ paused=!!b; }
  function init(canvas,labels,th){
    try{
      cv=canvas; labelsEl=labels; theme=th&&th!=="classic"?th:"village"; computeLamps(theme);
      gl=cv.getContext("webgl",{antialias:true,alpha:false,powerPreference:"high-performance"})||cv.getContext("experimental-webgl");
      if(!gl) return false;
      P=prog(gl,VS,FS); SP=prog(gl,SKY_VS,SKY_FS); PP=prog(gl,PT_VS,PT_FS);
      stat=buildStatic(theme); meshes.tomb=buildTomb(); target=themed(mood); cur=clone(target);
      { const g=new Geo(); g.ring({},.55,.7,28,[1,.8,.3],2); meshes.sel=g.upload(gl); }
      { const g=new Geo(); g.ring({},0,.62,20,[0,0,0],0); meshes.blob=g.upload(gl); }
      { const g=new Geo(); for(const s of [-1,1]) g.sph({t:[s*.12,0,0],s:[1.3,.75,.5]},.05,6,4,[1,.85,.2],2); meshes.eyes=g.upload(gl); }
      meshes.sky=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,meshes.sky); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      ptBuf=gl.createBuffer();
      for(let i=0;i<12;i++){ const a=hash(i*13.3)*Math.PI*2, r=23+hash(i*4.1)*7; eyes.push({x:Math.sin(a)*r,z:Math.cos(a)*r,y:.7+hash(i)*.8,ry:a+Math.PI,ph:hash(i*7)*20,on:hash(i*3)}); }
      for(let i=0;i<120;i++){ stepParts(1/30,i/30); }
      cv.addEventListener("pointermove",onMove); cv.addEventListener("pointerdown",onDown); window.addEventListener("pointerup",onUp); cv.addEventListener("wheel",e=>{ zoom=clamp(zoom*(e.deltaY>0?1.08:.93),.6,1.5); e.preventDefault(); },{passive:false});
      ok=true; loop(); return true;
    }catch(e){ console.warn("3D disabled",e); ok=false; return false; }
  }
  function seatPos(i,n){ const R=clamp(n*.48,3.3,7.6); const a=i/n*Math.PI*2; return {x:Math.sin(a)*R,z:Math.cos(a)*R,ang:a,R}; }
  function setPlayers(list,meId){
    me=meId;
    const n=Math.max(list.length,1);
    const seen=new Set();
    list.forEach((p,i)=>{
      seen.add(p.id);
      let c=chars[p.id];
      const key=JSON.stringify(p.av||{});
      if(!c||c.key!==key){ if(c){ gl.deleteBuffer(c.m.b.b); gl.deleteBuffer(c.m.h.b); } c=chars[p.id]={id:p.id,key,m:buildChar(p.av||{s:0,h:0,hc:0,t:0,o:0,a:0}),x:0,z:0,ang:0,die:p.alive===false?1:0,alive:p.alive!==false,talk:0,nod:0,seed:Math.random()*10}; }
      const s=seatPos(i,n); c.tx=s.x; c.tz=s.z; c.tang=s.ang; if(c.x===0&&c.z===0){ c.x=s.x; c.z=s.z; c.ang=s.ang; }
      if(c.alive&&p.alive===false){ c.dying=0.0001; }
      c.alive=p.alive!==false; c.sel=!!p.sel; c.click=!!p.click; c.sleep=!!p.sleep; c.inact=!!p.inact; c.wolf=!!p.wolf;
    });
    for(const id of Object.keys(chars)) if(!seen.has(id)){ gl.deleteBuffer(chars[id].m.b.b); gl.deleteBuffer(chars[id].m.h.b); delete chars[id]; }
    players=list.map(p=>p.id);
  }
  function setVotes(v){ votes=v||{}; }
  function setMood(m){ if(PAL[m]&&m!==mood){ mood=m; target=themed(m); } }
  function speak(id){ const c=chars[id]; if(c) c.talk=2.2; }
  function setPick(fn,can){ onPick=fn; isClickable=can; }
  function camPos(){
    const meC=me&&chars[me]; const base=meC?meC.ang:Math.PI*.15;
    const a=base+camDrag; const R=(meC?seatPos(0,players.length).R:5)*1.1+8.5*zoom; const tt=(performance.now()-T0)/1000;
    const sway=Math.sin(tt*.21)*.06+(mood==="night"||mood==="wolves"?Math.sin(tt*.9)*.012:0);
    return {eye:[Math.sin(a+sway)*R,5.0*zoom+.8+Math.sin(tt*.33)*.08,Math.cos(a+sway)*R],at:[0,1.0,0]};
  }
  let VPm=null,camE=null,W=1,H=1;
  function project(p){ const m=VPm; const x=m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], y=m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];
    return {x:(x/w*.5+.5)*W, y:(1-(y/w*.5+.5))*H, w}; }
  function hit(e){ if(!VPm) return null; const r=cv.getBoundingClientRect(); const mx=e.clientX-r.left,my=e.clientY-r.top; let best=null,bd=1e9;
    for(const id of players){ const c=chars[id]; if(!c) continue; const a=project([c.x,1.0,c.z]); if(a.w<=0) continue; const rad=(H*.9)/a.w*.9; const d=Math.hypot(mx-a.x,(my-a.y)*.7); if(d<rad&&d<bd){ bd=d; best=id; } }
    return best; }
  function onMove(e){ if(dragging){ camDrag+= (e.clientX-dragX)*.006; dragX=e.clientX; dragMoved+=1; return; } const id=hit(e); hoverId=id&&isClickable(id)?id:null; cv.style.cursor=hoverId?"pointer":"grab"; }
  let dragMoved=0;
  function onDown(e){ dragging=true; dragX=e.clientX; dragMoved=0; downId=hit(e); }
  let downId=null;
  function onUp(e){ if(!dragging) return; dragging=false; if(dragMoved<4&&downId&&isClickable(downId)&&onPick) onPick(downId); }
  function anchor(id){ const c=chars[id]; if(!c||!VPm) return null; const top=project([c.x,c.alive||c.die<1?2.12:1.45,c.z]); const base=project([c.x,0,c.z]); return {x:top.x,y:top.y,w:top.w,bx:base.x,by:base.y,vis:top.w>0}; }

  /* ---------- render loop ---------- */
  function loop(){
    raf=requestAnimationFrame(loop);
    if(document.hidden||!ok||paused) return;
    const now=performance.now(), t=(now-T0)/1000; let dt=Math.min(.05,(now-(lastT||now))/1000); lastT=now;
    // palette lerp
    const k=1-Math.exp(-dt*1.2);
    for(const key in cur){ const a=cur[key], b=target[key]; if(Array.isArray(a)) cur[key]=lerp3(a,b,k); else cur[key]=lerp(a,b,k); }
    cur.sunDir=nrm(cur.sunDir);
    // resize
    const dpr=Math.min(window.devicePixelRatio||1,1.6); const w=Math.max(1,Math.floor(cv.clientWidth*dpr)), h=Math.max(1,Math.floor(cv.clientHeight*dpr));
    if(cv.width!==w||cv.height!==h){ cv.width=w; cv.height=h; } W=cv.clientWidth; H=cv.clientHeight;
    gl.viewport(0,0,w,h);
    // animate chars
    for(const id of players){ const c=chars[id]; if(!c) continue;
      c.x=lerp(c.x,c.tx,k*2); c.z=lerp(c.z,c.tz,k*2); c.ang=c.tang;
      if(c.talk>0) c.talk-=dt; if(c.dying){ c.dying+=dt; c.die=Math.min(1,c.dying/1.6); if(c.die>=1) c.dying=0; }
      if(!c.alive&&!c.dying) c.die=1; if(c.alive) c.die=0; }
    stepParts(dt,t); stepSparks(dt,t);
    // camera
    const cp=camPos(); camE=cp.eye;
    const proj=persp(50*Math.PI/180,W/H,.1,400), view=lookAt(cp.eye,cp.at,[0,1,0]); VPm=mul(proj,view);
    gl.clearColor(cur.fog[0],cur.fog[1],cur.fog[2],1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    // sky
    gl.disable(gl.DEPTH_TEST); gl.useProgram(SP.p);
    const fwd=nrm(sub(cp.at,cp.eye)), right=nrm(cross(fwd,[0,1,0])), up=cross(right,fwd);
    gl.uniform3fv(SP.u.uR,right); gl.uniform3fv(SP.u.uU,up); gl.uniform3fv(SP.u.uF,fwd); gl.uniform1f(SP.u.uTH,Math.tan(25*Math.PI/180)); gl.uniform1f(SP.u.uAsp,W/H);
    gl.uniform3fv(SP.u.uTop,cur.top); gl.uniform3fv(SP.u.uHor,cur.hor); gl.uniform3fv(SP.u.uFogCol,cur.fog); const fh=nrm([fwd[0],0,fwd[2]]); gl.uniform3fv(SP.u.uMoonDir,nrm(add(add(fh,scl(right,.42)),[0,.36,0]))); gl.uniform3fv(SP.u.uSunDir,nrm(cur.sunDir));
    gl.uniform3fv(SP.u.uMoonCol,cur.moon); gl.uniform3fv(SP.u.uSunCol,cur.sun); gl.uniform1f(SP.u.uStars,cur.stars); gl.uniform1f(SP.u.uTime,t);
    gl.bindBuffer(gl.ARRAY_BUFFER,meshes.sky); gl.enableVertexAttribArray(SP.a.aP); gl.vertexAttribPointer(SP.a.aP,2,gl.FLOAT,false,0,0); gl.drawArrays(gl.TRIANGLES,0,3); gl.disableVertexAttribArray(SP.a.aP);
    // scene
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.useProgram(P.p);
    const U=P.u;
    gl.uniformMatrix4fv(U.uVP,false,VPm); gl.uniform3fv(U.uSunDir,cur.sunDir); gl.uniform3fv(U.uSunCol,cur.sunCol); gl.uniform3fv(U.uSkyAmb,cur.sky); gl.uniform3fv(U.uGndAmb,cur.gnd);
    gl.uniform3fv(U.uFogCol,cur.fog); gl.uniform1f(U.uFogD,cur.fogD); gl.uniform3fv(U.uCam,cp.eye);
    const fl=.82+.1*Math.sin(t*13.1)+.06*Math.sin(t*7.3+1)+.05*Math.sin(t*23.7);
    gl.uniform3fv(U.uFireP,[Math.sin(t*5)*.08,1.05,Math.cos(t*4)*.08]); gl.uniform3fv(U.uFireC,scl(cur.fire,fl*2.1));
    const lp=new Float32Array(18); LAMPS.forEach((L,i)=>lp.set(L,i*3)); gl.uniform3fv(U.uLampP,lp); gl.uniform3fv(U.uLampC,scl(cur.lamp,.9+.1*Math.sin(t*3)));
    gl.uniform3fv(U.uHiCol,[0,0,0]); gl.uniform1f(U.uHi,0); gl.uniform1f(U.uEm,0); gl.uniform1f(U.uAlpha,1); gl.uniform1f(U.uNoFog,0); gl.uniform1f(U.uWin,cur.win); gl.uniform1f(U.uTime,t); gl.uniform3fv(U.uTint,[1,1,1]);
    const draw=(m,M)=>{ gl.uniformMatrix4fv(U.uM,false,M); gl.bindBuffer(gl.ARRAY_BUFFER,m.b);
      gl.enableVertexAttribArray(P.a.aP); gl.vertexAttribPointer(P.a.aP,3,gl.FLOAT,false,40,0);
      gl.enableVertexAttribArray(P.a.aN); gl.vertexAttribPointer(P.a.aN,3,gl.FLOAT,false,40,12);
      gl.enableVertexAttribArray(P.a.aC); gl.vertexAttribPointer(P.a.aC,4,gl.FLOAT,false,40,24);
      gl.drawArrays(gl.TRIANGLES,0,m.n); };
    const I=model(0,0,0); draw(stat,I);
    // characters
    for(const id of players){ const c=chars[id]; if(!c) continue;
      const ry=c.ang+Math.PI; // face center
      const hi = id===hoverId?1:(c.click?.45+.25*Math.sin(t*4):0);
      if(c.die<1){
        const fall=c.die, tilt=-fall*1.35, sink=fall*.6, sc=1-fall*.15;
        gl.uniform3fv(U.uTint,c.inact?[.55,.55,.6]:[1,1,1]);
        gl.uniform3fv(U.uHiCol,id===hoverId?[1,.85,.45]:[.7,.55,1]); gl.uniform1f(U.uHi,hi*(1-fall));
        const breath=1+Math.sin(t*1.6+c.seed)*.012;
        const B=model(c.x,-sink,c.z,ry,tilt,sc,sc*breath); draw(c.m.b,B);
        // head
        let nod=c.sleep?.42+Math.sin(t*.8+c.seed)*.04:0, turn=0;
        if(c.talk>0) nod+=Math.sin(t*9)*.08; else if(!c.sleep) { turn=Math.sin(t*.37+c.seed*2)*.35; nod+=Math.sin(t*.5+c.seed)*.05; }
        const hy=1.15*sc*breath;
        const Hm=mul(model(c.x,-sink,c.z,ry,tilt,1),mul(model(0,hy,0,turn,nod,sc),new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])));
        draw(c.m.h,Hm);
        gl.uniform1f(U.uHi,0); gl.uniform3fv(U.uTint,[1,1,1]);
      }
      if(c.die>.5){ const rise=clamp((c.die-.5)*2,0,1); draw(meshes.tomb,model(c.x*1.04,-(1-rise)*1.2,c.z*1.04,ry,0,1)); }
      if(c.sel&&c.die<1){ gl.uniform1f(U.uEm,.6+.4*Math.sin(t*5)); draw(meshes.sel,model(c.x,.03,c.z,0,0,1)); gl.uniform1f(U.uEm,0); }
    }
    // wolf eyes in the forest
    if(cur.eyes>.05){ gl.uniform1f(U.uNoFog,1); gl.uniform1f(U.uEm,2*cur.eyes);
      for(const e of eyes){ if(e.on>cur.eyes) continue; const bl=Math.sin(t*.7+e.ph); if(bl<-.2) continue; const open=Math.max(.05,Math.min(1,(Math.sin(t*3.1+e.ph*3)+1)*4)); draw(meshes.eyes,model(e.x+Math.sin(t*.2+e.ph)*.6,e.y,e.z,Math.atan2(camE[0]-e.x,camE[2]-e.z),0,2.6,2.6*open)); }
      gl.uniform1f(U.uNoFog,0); gl.uniform1f(U.uEm,0); }
    // blob shadows
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.uniform1f(U.uAlpha,.35);
    for(const id of players){ const c=chars[id]; if(c&&c.die<1) draw(meshes.blob,model(c.x,.015,c.z,0,0,1)); }
    gl.uniform1f(U.uAlpha,1);
    gl.disableVertexAttribArray(P.a.aN); gl.disableVertexAttribArray(P.a.aC);
    // particles
    gl.useProgram(PP.p); gl.uniformMatrix4fv(PP.u.uVP,false,VPm); gl.uniform1f(PP.u.uScale,(cv.height)/(2*Math.tan(25*Math.PI/180)));
    const drawPts=(add)=>{ const d=fillParts(add); if(!d.length) return; gl.bindBuffer(gl.ARRAY_BUFFER,ptBuf); gl.bufferData(gl.ARRAY_BUFFER,d,gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(PP.a.aP); gl.vertexAttribPointer(PP.a.aP,3,gl.FLOAT,false,32,0);
      gl.enableVertexAttribArray(PP.a.aS); gl.vertexAttribPointer(PP.a.aS,1,gl.FLOAT,false,32,12);
      gl.enableVertexAttribArray(PP.a.aC); gl.vertexAttribPointer(PP.a.aC,4,gl.FLOAT,false,32,16);
      gl.uniform1f(PP.u.uAdd,add?1:0); gl.drawArrays(gl.POINTS,0,d.length/8); };
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); drawPts(false);
    gl.blendFunc(gl.ONE,gl.ONE); drawPts(true);
    gl.disable(gl.BLEND); gl.depthMask(true);
    for(const k2 in PP.a) gl.disableVertexAttribArray(PP.a[k2]);
    // labels
    if(labelsEl){ for(const el of labelsEl.children){ const id=el.dataset.id; const a=anchor(id); if(!a||!a.vis){ el.style.display="none"; continue; } el.style.display=""; const s=clamp(9/a.w,.62,1.15);
      el.style.transform=`translate(${a.x.toFixed(1)}px,${a.y.toFixed(1)}px) translate(-50%,-100%) scale(${s.toFixed(3)})`; el.style.zIndex=String(1000-Math.round(a.w*10)); } }
  }
  return {init,setPlayers,setVotes,setMood,setTheme,pause,speak,setPick,get ok(){return ok;}, anchor};
})();
