/* ===================== R4 : moteur 3D WebGL2 (HDR, ombres, post-process) ===================== */
const R4 = {};
(function(){
  "use strict";
  /* ---------- maths ---------- */
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], scl=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const len=a=>Math.hypot(a[0],a[1],a[2]), nrm=a=>{ const l=len(a)||1; return [a[0]/l,a[1]/l,a[2]/l]; };
  const lerp=(a,b,t)=>a+(b-a)*t, lerp3=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)), smooth=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
  function hash(n){ const x=Math.sin(n*127.1+311.7)*43758.5453; return x-Math.floor(x); }
  function hash3(x,y,z){ const h=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453; return h-Math.floor(h); }
  function vnoise(x,y,z){ const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),fx=x-ix,fy=y-iy,fz=z-iz;
    const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),w=fz*fz*(3-2*fz); const h=(a,b,c)=>hash3(ix+a,iy+b,iz+c);
    return lerp(lerp(lerp(h(0,0,0),h(1,0,0),u),lerp(h(0,1,0),h(1,1,0),u),v),lerp(lerp(h(0,0,1),h(1,0,1),u),lerp(h(0,1,1),h(1,1,1),u),v),w); }
  const fbm=(x,y,z,o=4)=>{ let s=0,a=.5,f=1; for(let i=0;i<o;i++){ s+=a*vnoise(x*f,y*f,z*f); f*=2.03; a*=.5; } return s; };
  const M={
    id:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
    mul(a,b){ const o=new Float32Array(16); for(let i=0;i<4;i++)for(let j=0;j<4;j++){ let s=0; for(let k=0;k<4;k++) s+=a[k*4+j]*b[i*4+k]; o[i*4+j]=s; } return o; },
    persp(fov,asp,n,f){ const t=1/Math.tan(fov/2), nf=1/(n-f); return new Float32Array([t/asp,0,0,0, 0,t,0,0, 0,0,(f+n)*nf,-1, 0,0,2*f*n*nf,0]); },
    ortho(l,r,b,t,n,f){ return new Float32Array([2/(r-l),0,0,0, 0,2/(t-b),0,0, 0,0,-2/(f-n),0, -(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]); },
    lookAt(e,c,u){ const z=nrm(sub(e,c)), x=nrm(cross(u,z)), y=cross(z,x); return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,e),-dot(y,e),-dot(z,e),1]); },
    rot3(rx,ry,rz){ // R = Ry*Rx*Rz (row-major 3x3)
      const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz);
      const Rz=[[cz,-sz,0],[sz,cz,0],[0,0,1]], Rx=[[1,0,0],[0,cx,-sx],[0,sx,cx]], Ry=[[cy,0,sy],[0,1,0],[-sy,0,cy]];
      const m3=(A,B)=>A.map((r,i)=>[0,1,2].map(j=>r[0]*B[0][j]+r[1]*B[1][j]+r[2]*B[2][j]));
      return m3(Ry,m3(Rx,Rz)); },
    trs(t,r,s=1,sy){ const R=M.rot3(r[0],r[1],r[2]); const o=new Float32Array(16); const S=[s,sy==null?s:sy,s];
      for(let c=0;c<3;c++) for(let rr=0;rr<3;rr++) o[c*4+rr]=R[rr][c]*S[c]; o[12]=t[0]; o[13]=t[1]; o[14]=t[2]; o[15]=1; return o; },
    xf(m,p){ return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]]; }
  };
  Object.assign(R4,{sub,add,scl,dot,cross,len,nrm,lerp,lerp3,clamp,smooth,hash,hash3,vnoise,fbm,M});

  /* ---------- géométrie : [pos3 nor3 couleur3 matériau1] ---------- */
  class Geo{
    constructor(){ this.a=[]; }
    _x(o){ const t=o.t||[0,0,0], r=o.r||[0,0,0], s=o.s||[1,1,1]; const R=M.rot3(r[0],r[1],r[2]);
      const rot=v=>[R[0][0]*v[0]+R[0][1]*v[1]+R[0][2]*v[2],R[1][0]*v[0]+R[1][1]*v[1]+R[1][2]*v[2],R[2][0]*v[0]+R[2][1]*v[1]+R[2][2]*v[2]];
      return {p:v=>add(rot([v[0]*s[0],v[1]*s[1],v[2]*s[2]]),t), n:v=>nrm(rot([v[0]/s[0],v[1]/s[1],v[2]/s[2]]))}; }
    v(P,N,c,m){ this.a.push(P[0],P[1],P[2],N[0],N[1],N[2],c[0],c[1],c[2],m); }
    tri(X,p0,p1,p2,n0,n1,n2,c,m,c1,c2){ this.v(X.p(p0),X.n(n0),c,m); this.v(X.p(p1),X.n(n1),c1||c,m); this.v(X.p(p2),X.n(n2),c2||c,m); }
    box(o,c,m=0){ const X=this._x(o),h=.5; const F=[[[0,0,1],[-h,-h,h],[h,-h,h],[h,h,h],[-h,h,h]],[[0,0,-1],[h,-h,-h],[-h,-h,-h],[-h,h,-h],[h,h,-h]],[[1,0,0],[h,-h,h],[h,-h,-h],[h,h,-h],[h,h,h]],[[-1,0,0],[-h,-h,-h],[-h,-h,h],[-h,h,h],[-h,h,-h]],[[0,1,0],[-h,h,h],[h,h,h],[h,h,-h],[-h,h,-h]],[[0,-1,0],[-h,-h,-h],[h,-h,-h],[h,-h,h],[-h,-h,h]]];
      for(const [n,a,b,c2,d] of F){ this.tri(X,a,b,c2,n,n,n,c,m); this.tri(X,a,c2,d,n,n,n,c,m); } return this; }
    // cylindre/tronc de cône lissé, base y=0 -> h
    cyl(o,rt,rb,h,seg,c,m=0,caps=true,ct){ const X=this._x(o); const sl=(rb-rt)/h;
      for(let i=0;i<seg;i++){ const a0=i/seg*Math.PI*2,a1=(i+1)/seg*Math.PI*2;
        const b0=[Math.sin(a0)*rb,0,Math.cos(a0)*rb],b1=[Math.sin(a1)*rb,0,Math.cos(a1)*rb],t0=[Math.sin(a0)*rt,h,Math.cos(a0)*rt],t1=[Math.sin(a1)*rt,h,Math.cos(a1)*rt];
        const nA=nrm([Math.sin(a0),sl,Math.cos(a0)]),nB=nrm([Math.sin(a1),sl,Math.cos(a1)]);
        this.tri(X,b0,b1,t1,nA,nB,nB,c,m,c,ct||c); if(rt>0) this.tri(X,b0,t1,t0,nA,nB,nA,c,m,ct||c,ct||c);
        if(caps){ if(rt>0) this.tri(X,[0,h,0],t0,t1,[0,1,0],[0,1,0],[0,1,0],ct||c,m); this.tri(X,[0,0,0],b1,b0,[0,-1,0],[0,-1,0],[0,-1,0],c,m); } }
      return this; }
    // ellipsoïde lissé
    sph(o,r,ws,hs,c,m=0,cfn){ const X=this._x(o);
      const P=(i,j)=>{ const th=j/hs*Math.PI, ph=i/ws*Math.PI*2; return [Math.sin(th)*Math.sin(ph)*r,Math.cos(th)*r,Math.sin(th)*Math.cos(ph)*r]; };
      for(let j=0;j<hs;j++) for(let i=0;i<ws;i++){ const a=P(i,j),b=P(i,j+1),c2=P(i+1,j+1),d=P(i+1,j);
        const ca=cfn?cfn(a):c, cb=cfn?cfn(b):c, cc=cfn?cfn(c2):c, cd=cfn?cfn(d):c;
        if(j>0) this.tri(X,a,b,c2,nrm(a),nrm(b),nrm(c2),ca,m,cb,cc); if(j<hs-1) this.tri(X,a,c2,d,nrm(a),nrm(c2),nrm(d),ca,m,cc,cd); }
      return this; }
    // capsule le long de y (base 0 -> h), rayons r0 (bas) r1 (haut)
    cap(o,r0,r1,h,seg,c,m=0){ this.cyl(o,r1,r0,h,seg,c,m,false); const X0=Object.assign({},o);
      this.sph(Object.assign({},o),r0,seg,6,c,m); const ot=Object.assign({},o); const T=this._x(o); ot.t=T.p([0,h,0]); ot.s=[ (o.s||[1,1,1])[0],(o.s||[1,1,1])[1],(o.s||[1,1,1])[2] ]; this.sph(ot,r1,seg,6,c,m); return this; }
    torus(o,R,r,seg,sseg,c,m=0){ const X=this._x(o);
      const P=(i,j)=>{ const u=i/seg*Math.PI*2,v=j/sseg*Math.PI*2; return [[(R+r*Math.cos(v))*Math.cos(u),r*Math.sin(v),(R+r*Math.cos(v))*Math.sin(u)],[Math.cos(v)*Math.cos(u),Math.sin(v),Math.cos(v)*Math.sin(u)]]; };
      for(let i=0;i<seg;i++) for(let j=0;j<sseg;j++){ const [a,na]=P(i,j),[b,nb]=P(i+1,j),[c2,nc]=P(i+1,j+1),[d,nd]=P(i,j+1);
        this.tri(X,a,b,c2,na,nb,nc,c,m); this.tri(X,a,c2,d,na,nc,nd,c,m); } return this; }
    prism(o,c,m=0){ const X=this._x(o),h=.5; const A=[-h,0,h],B=[h,0,h],C=[h,1,0],D=[-h,1,0],E=[-h,0,-h],F=[h,0,-h];
      const n1=nrm([0,.5,1]),n2=nrm([0,.5,-1]); this.tri(X,A,B,C,n1,n1,n1,c,m); this.tri(X,A,C,D,n1,n1,n1,c,m); this.tri(X,F,E,D,n2,n2,n2,c,m); this.tri(X,F,D,C,n2,n2,n2,c,m);
      const cs=c.map(x=>x*.85); this.tri(X,B,F,C,[1,0,0],[1,0,0],[1,0,0],cs,m); this.tri(X,E,A,D,[-1,0,0],[-1,0,0],[-1,0,0],cs,m); return this; }
    // icosphère déformée par du bruit (rochers, feuillages)
    blob(o,r,subd,amp,freq,seed,c,m=0,cfn){
      let V=[],F=[]; const t=(1+Math.sqrt(5))/2;
      V=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(nrm);
      F=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
      for(let s=0;s<subd;s++){ const cache={}; const mid=(a,b)=>{ const k=a<b?a+"_"+b:b+"_"+a; if(cache[k]!=null) return cache[k]; V.push(nrm(scl(add(V[a],V[b]),.5))); return cache[k]=V.length-1; };
        const NF=[]; for(const [a,b,c2] of F){ const ab=mid(a,b),bc=mid(b,c2),ca=mid(c2,a); NF.push([a,ab,ca],[b,bc,ab],[c2,ca,bc],[ab,bc,ca]); } F=NF; }
      const P=V.map(v=>scl(v,r*(1+amp*(fbm(v[0]*freq+seed,v[1]*freq+seed*.7,v[2]*freq-seed,3)-.5)*2)));
      const N=P.map(()=>[0,0,0]); for(const [a,b,c2] of F){ const fn=cross(sub(P[b],P[a]),sub(P[c2],P[a])); for(const i of [a,b,c2]) N[i]=add(N[i],fn); }
      const X=this._x(o); for(const [a,b,c2] of F){ const ca=cfn?cfn(P[a],nrm(N[a])):c, cb=cfn?cfn(P[b],nrm(N[b])):c, cc=cfn?cfn(P[c2],nrm(N[c2])):c;
        this.v(X.p(P[a]),X.n(nrm(N[a])),ca,m); this.v(X.p(P[b]),X.n(nrm(N[b])),cb,m); this.v(X.p(P[c2]),X.n(nrm(N[c2])),cc,m); }
      return this; }
  }
  R4.Geo=Geo;

  /* ---------- GL ---------- */
  function compile(gl,vs,fs){
    const sh=(t,s)=>{ const o=gl.createShader(t); gl.shaderSource(o,s); gl.compileShader(o); if(!gl.getShaderParameter(o,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)+"\n"+s.split("\n").slice(0,4).join("\n")); return o; };
    const p=gl.createProgram(); gl.attachShader(p,sh(gl.VERTEX_SHADER,vs)); gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u={}; const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS); for(let i=0;i<n;i++){ const nm=gl.getActiveUniform(p,i).name.replace("[0]",""); u[nm]=gl.getUniformLocation(p,nm); }
    return {p,u};
  }
  R4.compile=compile;
  R4.mesh=function(gl,geo){ const d=new Float32Array(geo.a); const vao=gl.createVertexArray(); gl.bindVertexArray(vao);
    const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,40,0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,40,12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,4,gl.FLOAT,false,40,24);
    gl.bindVertexArray(null); return {vao,b,n:d.length/10}; };
  R4.free=function(gl,m){ if(!m) return; gl.deleteVertexArray(m.vao); gl.deleteBuffer(m.b); };

  /* ---------- shaders ---------- */
  const NOISE=`
  float h3(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
  float vn(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
  float fbm(vec3 p){ float s=0.,a=.5; for(int i=0;i<4;i++){ s+=a*vn(p); p*=2.03; a*=.5; } return s; }`;
  R4.STD_VS=`#version 300 es
  layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec4 aC;
  uniform mat4 uVP,uM; uniform float uTime,uWind;
  out vec3 vW; out vec3 vN; out vec4 vC; out vec2 vUV;
  void main(){ vec4 w=uM*vec4(aP,1.); float m=floor(aC.a+.5); vUV=vec2(0.);
    if(m==6.){ float h=max(w.y-.3,0.); w.x+=sin(uTime*1.3+w.z*.31+w.x*.2)*.025*h*uWind; w.z+=cos(uTime*1.1+w.x*.27)*.02*h*uWind; }
    vW=w.xyz; vN=mat3(uM)*aN; vC=aC; gl_Position=uVP*w; }`;
  R4.STD_FS=`#version 300 es
  precision highp float; precision highp sampler2DShadow;
  in vec3 vW; in vec3 vN; in vec4 vC; in vec2 vUV; out vec4 o;
  uniform sampler2D uAlb,uNrm; uniform float uVcol,uRock,uNrmOn,uEmisK;
  uniform vec3 uCam,uKeyDir,uKeyCol,uSkyCol,uGndCol,uFogCol,uFogSun,uFireP,uFireC,uTint,uHiCol,uLampC; uniform vec3 uLamp[4];
  uniform float uFogD,uFogH,uTime,uWin,uHi,uAlpha,uFireR,uShadowOn,uFireShOn,uSnow,uGround,uClr;
  uniform sampler2DShadow uShadow; uniform mat4 uLightVP; uniform highp samplerCube uFireSh; uniform float uShTexel;
  ${NOISE}
  float sunShadow(vec3 w,vec3 n){ vec4 lp=uLightVP*vec4(w+n*.05,1.); vec3 c=lp.xyz/lp.w*.5+.5;
    if(c.x<0.||c.x>1.||c.y<0.||c.y>1.||c.z>1.) return 1.; float s=0.;
    for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) s+=texture(uShadow,vec3(c.xy+vec2(x,y)*uShTexel*1.25,c.z-.0012));
    return s/9.; }
  float fireShadow(vec3 w,vec3 n){ vec3 d=w+n*.03-uFireP; float dist=length(d); vec3 dn=d/dist; vec3 t1=normalize(cross(dn,vec3(.31,1.,.17))), t2=cross(dn,t1); float s=0.;
    for(int i=0;i<4;i++){ vec2 of=vec2(i==0?1.:i==1?-1.:0., i==2?1.:i==3?-1.:0.)*.012; float sd=texture(uFireSh,dn+t1*of.x+t2*of.y).r; s+= dist-.06>sd?0.:1.; }
    return s*.25; }
  void main(){
    float m=floor(vC.a+.5); vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n;
    vec3 alb=vC.rgb*uTint; float rough=.8, spec=.03, wrap=0.;
    if(m==4.){ float f=fbm(vW*1.1), g=fbm(vW*.23+7.), d=fbm(vW*4.2);
      alb*=.72+.55*f; alb=mix(alb,alb*vec3(.85,.75,.62),smoothstep(.55,.7,g)*.6*uGround);
      n=normalize(n+vec3(d-.5,0.,fbm(vW*4.2+3.)-.5)*.35);
      float cl=smoothstep(uClr+.8,uClr-1.2,length(vW.xz)+(f-.5)*1.6)*uGround*step(.2,uClr); alb=mix(alb,vec3(.16,.11,.07)*(.7+.6*d),cl*.8); }
    if(m==5.){ float f=fbm(vW*2.2); alb*=.66+.6*f;
      float moss=smoothstep(.5,.8,n.y+(fbm(vW*1.4)-.5)*.6); alb=mix(alb,vec3(.13,.19,.06)*(.75+.5*f),moss*.85*(1.-uSnow)*uGround);
      alb=mix(alb,vec3(.9,.93,.98),smoothstep(.35,.7,n.y)*uSnow); n=normalize(n+(vec3(fbm(vW*7.),fbm(vW*7.+5.),fbm(vW*7.+9.))-.5)*.4); rough=.9; }
    if(m==7.){ alb*=.62+.6*fbm(vec3(vW.x*9.,vW.y*1.4,vW.z*9.)); rough=.9; }
    if(m==3.){ wrap=.5; rough=.5; spec=.035; }
    if(m==8.){ rough=.35; spec=.05; wrap=.2; }
    if(m==9.){ wrap=.3; alb*=.93+.12*vn(vW*60.); }
    if(m==6.){ wrap=.6; alb*=.8+.4*fbm(vW*3.); alb=mix(alb,vec3(.92,.95,1.),smoothstep(.2,.6,n.y)*uSnow); }
    if(m==10.){ rough=.15; spec=.6; }
    if(m==11.){ alb=texture(uAlb,vUV).rgb*uTint; vec3 tn=texture(uNrm,vUV).xyz*2.-1.;
      vec3 dp1=dFdx(vW),dp2=dFdy(vW); vec2 du1=dFdx(vUV),du2=dFdy(vUV); vec3 d2p=cross(dp2,n),d1p=cross(n,dp1);
      vec3 T=d2p*du1.x+d1p*du2.x, B=d2p*du1.y+d1p*du2.y; float iv=inversesqrt(max(max(dot(T,T),dot(B,B)),1e-12));
      n=normalize(mat3(T*iv,B*iv,n)*vec3(tn.xy*.8,tn.z)); wrap=.3; rough=.6; spec=.035; }
    if(m>11.5){ vec4 tx=texture(uAlb,vUV); if(m>12.5&&tx.a<.42) discard;
      alb=tx.rgb*mix(vec3(1.),vC.rgb,uVcol)*uTint;
      if(uNrmOn>.5){ vec3 tn=texture(uNrm,vUV).xyz*2.-1.; vec3 dp1=dFdx(vW),dp2=dFdy(vW); vec2 du1=dFdx(vUV),du2=dFdy(vUV); vec3 d2p=cross(dp2,n),d1p=cross(n,dp1);
        vec3 T=d2p*du1.x+d1p*du2.x, B=d2p*du1.y+d1p*du2.y; float iv=inversesqrt(max(max(dot(T,T),dot(B,B)),1e-12)); n=normalize(mat3(T*iv,B*iv,n)*vec3(tn.xy,tn.z)); }
      rough=.85; spec=.02; if(m>12.5){ wrap=.6; }
      if(uRock>.5){ float moss=smoothstep(.55,.85,n.y+(fbm(vW*1.3)-.5)*.5); alb=mix(alb,vec3(.1,.16,.05)*(.8+.4*fbm(vW*3.)),moss*.7*(1.-uSnow)*uGround); }
      alb=mix(alb,vec3(.88,.92,.98),smoothstep(.3,.7,n.y)*uSnow*(m>12.5?.9:.85)); }
    vec3 V=normalize(uCam-vW); float a=rough*rough;
    float ndl=dot(n,uKeyDir); float dif=max((ndl+wrap)/(1.+wrap),0.);
    float sh=uShadowOn>.5?sunShadow(vW,n):1.;
    vec3 H=normalize(uKeyDir+V); float nh=max(dot(n,H),0.); float D=a*a/(3.1416*pow(nh*nh*(a*a-1.)+1.,2.));
    vec3 col=(alb*dif+spec*D*max(ndl,0.))*uKeyCol*sh;
    col+=alb*mix(uGndCol,uSkyCol,n.y*.5+.5);
    vec3 L=uFireP-vW; float d=length(L); vec3 l=L/d; float fd=max((dot(n,l)+wrap)/(1.+wrap),0.);
    float att=(1./(1.+d*d*.28))*smoothstep(uFireR,uFireR*.25,d);
    float fsh=uFireShOn>.5?fireShadow(vW,n):1.;
    vec3 Hf=normalize(l+V); float nhf=max(dot(n,Hf),0.); float Df=a*a/(3.1416*pow(nhf*nhf*(a*a-1.)+1.,2.));
    col+=(alb*fd+spec*Df*fd)*uFireC*att*fsh;
    for(int i=0;i<4;i++){ vec3 Ll=uLamp[i]-vW; float dl=length(Ll); col+=alb*uLampC*(max(dot(n,Ll/dl),0.)*.7+.3)/(1.+dl*dl*.9); }
    if(m==1.) col+=vC.rgb*uWin*4.;
    if(m>11.5&&uEmisK>.5) col+=vec3(1.,.6,.26)*uWin*3.2*(.6+.4*alb.r);
    if(m==2.) col+=vC.rgb*3.;
    float rim=pow(1.-max(dot(n,V),0.),3.);
    col+=uHiCol*uHi*(rim*2.5+.12);
    if(m==3.||m==8.||m==9.||m==11.) col+=rim*(uSkyCol*.35+uFireC*att*.25);
    float dist=length(uCam-vW);
    float fa=1.-exp(-dist*uFogD*exp(-max(vW.y,0.)*uFogH));
    vec3 vd=normalize(vW-uCam); vec3 fc=uFogCol+uFogSun*pow(max(dot(vd,uKeyDir),0.),8.);
    if(m==1.||m==2.) fa*=.55;
    if(m>12.5) col+=alb*uFireC*att*.12*max(-dot(n,l),0.); // un peu de lumière traversant les feuilles
    col=mix(col,fc,clamp(fa,0.,1.));
    if(uAlpha<.999){ float th=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453); if(th>uAlpha) discard; }
    o=vec4(col,1.); }`;
  R4.DEPTH_FS=`#version 300 es
  precision highp float; in vec3 vW; in vec3 vN; in vec4 vC; in vec2 vUV; uniform vec3 uFireP; uniform float uCube,uCut; uniform sampler2D uAlb; out vec4 o;
  void main(){ if(uCut>.5&&texture(uAlb,vUV).a<.42) discard; o=vec4(uCube>.5?length(vW-uFireP):0.); }`;
  // herbe instanciée
  R4.GRASS_VS=`#version 300 es
  layout(location=0) in vec3 aP; layout(location=3) in vec4 aI; layout(location=4) in vec3 aIC;
  uniform mat4 uVP; uniform float uTime,uWind,uClr; uniform vec3 uCam;
  out vec3 vW; out vec3 vC; out float vH;
  void main(){ float c=cos(aI.z),s=sin(aI.z); float h=aP.y; float rr=length(aI.xy); float kk=smoothstep(uClr-.6,uClr+1.8,rr+sin(aI.x*3.1+aI.y*2.3)*.5);
    vec3 p=vec3(aP.x*c,h*aI.w*mix(.18,1.,kk),aP.x*s);
    float w=sin(uTime*1.6+aI.x*.33+aI.y*.21)*.55+sin(uTime*2.7+aI.x*.8+aI.y*.4)*.25;
    p.x+=w*h*h*.22*uWind*aI.w; p.z+=w*h*h*.12*uWind*aI.w;
    vec3 wp=vec3(aI.x,0.,aI.y)+p; float dc=length(wp.xz-uCam.xz); if(dc<2.2) wp.y-=1.;
    vW=wp; vC=aIC; vH=h; gl_Position=uVP*vec4(wp,1.); }`;
  R4.GRASS_FS=`#version 300 es
  precision highp float; precision highp sampler2DShadow;
  in vec3 vW; in vec3 vC; in float vH; out vec4 o;
  uniform vec3 uCam,uKeyDir,uKeyCol,uSkyCol,uGndCol,uFogCol,uFogSun,uFireP,uFireC,uLampC; uniform vec3 uLamp[4];
  uniform float uFogD,uFogH,uShadowOn,uFireR,uSnow; uniform sampler2DShadow uShadow; uniform mat4 uLightVP; uniform float uShTexel;
  float sunShadow(vec3 w){ vec4 lp=uLightVP*vec4(w,1.); vec3 c=lp.xyz/lp.w*.5+.5; if(c.x<0.||c.x>1.||c.y<0.||c.y>1.||c.z>1.) return 1.;
    float s=0.; for(int x=-1;x<=1;x++) s+=texture(uShadow,vec3(c.xy+vec2(x,0)*uShTexel*1.5,c.z-.002)); return s/3.; }
  void main(){ vec3 alb=vC*mix(.35,1.15,vH); alb=mix(alb,vec3(.88,.92,.98),uSnow*vH);
    float sh=uShadowOn>.5?sunShadow(vW):1.;
    float k=max(uKeyDir.y,0.)*.6+.4;
    vec3 col=alb*uKeyCol*k*sh*.9+alb*mix(uGndCol,uSkyCol,.7);
    vec3 L=uFireP-vW; float d=length(L); col+=alb*uFireC*(.6+.4*vH)/(1.+d*d*.28)*smoothstep(uFireR,uFireR*.25,d);
    for(int i=0;i<4;i++){ vec3 Ll=uLamp[i]-vW; float dl=length(Ll); col+=alb*uLampC/(1.+dl*dl*.9); }
    vec3 V=normalize(vW-uCam); col+=alb*uKeyCol*pow(max(dot(V,uKeyDir),0.),4.)*vH*.6*sh;
    float dist=length(uCam-vW); float fa=1.-exp(-dist*uFogD*exp(-max(vW.y,0.)*uFogH));
    col=mix(col,uFogCol+uFogSun*pow(max(dot(V,uKeyDir),0.),8.),clamp(fa,0.,1.));
    o=vec4(col,1.); }`;
  // ciel analytique : dégradé selon la hauteur du soleil, halo, nuages, étoiles, lune
  R4.SKY_VS=`#version 300 es
  layout(location=0) in vec2 aP; uniform vec3 uR,uU,uF; uniform float uTH,uAsp; out vec3 vR;
  void main(){ vR=uF+aP.x*uAsp*uTH*uR+aP.y*uTH*uU; gl_Position=vec4(aP,.99999,1.); }`;
  R4.SKY_FS=`#version 300 es
  precision highp float; in vec3 vR; out vec4 o;
  uniform vec3 uZen,uHor,uSunDir,uSunCol,uMoonDir,uMoonCol,uFogCol,uCloudCol,uCloudLit; uniform float uStars,uTime,uCloud,uGlow;
  ${NOISE}
  float fbm2(vec2 p){ float s=0.,a=.5; for(int i=0;i<5;i++){ s+=a*vn(vec3(p,0.)); p=p*2.02+vec2(1.7,9.2); a*=.5; } return s; }
  void main(){ vec3 r=normalize(vR); float h=r.y;
    vec3 col=mix(uHor,uZen,pow(smoothstep(-.02,.75,h),.55));
    float sd=dot(r,uSunDir); col+=uSunCol*(pow(max(sd,0.),6.)*.35*uGlow+pow(max(sd,0.),64.)*.8*uGlow);
    col+=uSunCol*smoothstep(.9994,.9997,sd)*20.;
    if(h>0.){ vec3 q=floor(r*260.); float s=h3(q); float tw=.6+.4*sin(uTime*1.7+s*80.); col+=vec3(.85,.9,1.)*uStars*step(.9968,s)*(s-.9968)*900.*tw*smoothstep(0.,.3,h);
      float mw=exp(-pow(dot(r,normalize(vec3(.3,.7,-.6)))*3.,2.))*fbm(r*9.); col+=vec3(.35,.38,.55)*mw*uStars*.12; }
    float md=dot(r,uMoonDir); float disc=smoothstep(.99955,.99972,md);
    vec3 mc=uMoonCol*(.75+.25*fbm(r*140.)); col=mix(col,mc*2.2,disc*step(.01,length(uMoonCol)));
    col+=uMoonCol*(pow(max(md,0.),900.)*1.2+pow(max(md,0.),60.)*.12+pow(max(md,0.),8.)*.04);
    if(h>.0){ vec2 cp=r.xz/(h+.12)*1.2+vec2(uTime*.012,uTime*.004); float c=fbm2(cp*1.3); c=smoothstep(.48,.78,c)*uCloud*smoothstep(0.,.25,h);
      float lit=pow(max(dot(r,uSunDir)*.5+.5,0.),3.); vec3 cc=mix(uCloudCol,uCloudLit,lit); col=mix(col,cc,c*.85); }
    col=mix(uFogCol,col,smoothstep(-.06,.16,h));
    o=vec4(col,1.); }`;
  // particules instanciées (flammes procédurales, braises, fumée, neige, lucioles, étincelles)
  R4.PART_VS=`#version 300 es
  layout(location=0) in vec2 aQ; layout(location=1) in vec4 aPS; layout(location=2) in vec4 aCol; layout(location=3) in vec4 aK;
  uniform mat4 uVP; uniform vec3 uR,uU; out vec2 vUV; out vec4 vCol; out vec4 vK;
  void main(){ float rot=aK.z; vec2 q=vec2(aQ.x*cos(rot)-aQ.y*sin(rot),aQ.x*sin(rot)+aQ.y*cos(rot));
    vec3 up=aK.x<.5?vec3(0,1,0):uU; vec3 p=aPS.xyz+(uR*q.x+up*(q.y+(aK.x<.5?.5:0.)))*aPS.w;
    vUV=aQ+.5; vCol=aCol; vK=aK; gl_Position=uVP*vec4(p,1.); }`;
  R4.PART_FS=`#version 300 es
  precision highp float; in vec2 vUV; in vec4 vCol; in vec4 vK; out vec4 o; uniform float uTime,uAdd;
  ${NOISE}
  void main(){ float k=vK.x; vec2 uv=vUV;
    if(k<.5){ // flamme
      float t=uTime*1.6+vK.y*17.; vec2 q=uv-vec2(.5,0.);
      float nn=fbm(vec3(q.x*3.2+vK.y*5.,q.y*2.6-t*1.9,t*.3));
      float w=.36*(1.-uv.y*.85); float sh=1.-abs(q.x+(nn-.5)*.35*uv.y)/max(w,.02);
      float f=sh*1.3+nn*.8-uv.y*1.25-.35; f=clamp(f,0.,1.)*smoothstep(0.,.12,uv.y+.04);
      vec3 c=mix(vec3(1.6,.28,.04),vec3(3.2,1.5,.35),smoothstep(.15,.6,f)); c=mix(c,vec3(5.,3.8,2.2),smoothstep(.62,.95,f));
      float a=smoothstep(.04,.35,f); o=vec4(c*a*vCol.a,a*vCol.a); return; }
    float d=length(uv-.5)*2.;
    if(k<1.5){ float a=smoothstep(1.,.0,d); o=vec4(vCol.rgb*a*a*vCol.a*3.,a*vCol.a); return; } // braise / étincelle
    if(k<2.5){ float nn=fbm(vec3(uv*3.+vK.y*9.,uTime*.15+vK.y)); float a=smoothstep(1.,.15,d+(nn-.5)*.9)*vCol.a; o=vec4(vCol.rgb,a); return; } // fumée / brume
    float a=smoothstep(1.,0.,d); o=vec4(vCol.rgb*a*vCol.a,a*vCol.a); }`;
  // post-process
  R4.QUAD_VS=`#version 300 es
  layout(location=0) in vec2 aP; out vec2 vUV; void main(){ vUV=aP*.5+.5; gl_Position=vec4(aP,0.,1.); }`;
  R4.BRIGHT_FS=`#version 300 es
  precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform vec2 uPx;
  void main(){ vec3 c=vec3(0.); for(int x=-1;x<=1;x+=2) for(int y=-1;y<=1;y+=2) c+=texture(uTex,vUV+vec2(x,y)*uPx).rgb; c*=.25;
    float l=max(c.r,max(c.g,c.b)); float k=smoothstep(.9,2.2,l); o=vec4(c*k,1.); }`;
  R4.DOWN_FS=`#version 300 es
  precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uTex; uniform vec2 uPx;
  void main(){ vec3 c=texture(uTex,vUV).rgb*4.; c+=texture(uTex,vUV+vec2(-1,-1)*uPx).rgb+texture(uTex,vUV+vec2(1,-1)*uPx).rgb+texture(uTex,vUV+vec2(-1,1)*uPx).rgb+texture(uTex,vUV+vec2(1,1)*uPx).rgb; o=vec4(c/8.,1.); }`;
  R4.UP_FS=`#version 300 es
  precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uTex,uPrev; uniform vec2 uPx;
  void main(){ vec3 c=vec3(0.); c+=texture(uTex,vUV+vec2(-1,0)*uPx*2.).rgb+texture(uTex,vUV+vec2(1,0)*uPx*2.).rgb+texture(uTex,vUV+vec2(0,-1)*uPx*2.).rgb+texture(uTex,vUV+vec2(0,1)*uPx*2.).rgb;
    c+=(texture(uTex,vUV+vec2(-1,-1)*uPx).rgb+texture(uTex,vUV+vec2(1,-1)*uPx).rgb+texture(uTex,vUV+vec2(-1,1)*uPx).rgb+texture(uTex,vUV+vec2(1,1)*uPx).rgb)*2.;
    o=vec4(c/12.+texture(uPrev,vUV).rgb,1.); }`;
  R4.COMP_FS=`#version 300 es
  precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uScene,uBloom; uniform float uExp,uBloomK,uVig,uTime,uGrain; uniform vec3 uLift,uGain,uVigCol;
  vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
  void main(){ vec3 c=texture(uScene,vUV).rgb; vec3 b=texture(uBloom,vUV).rgb; c+=b*uBloomK;
    c*=uExp; c=aces(c); c=pow(c,vec3(1./2.2)); c=c*uGain+uLift*(1.-c);
    vec2 q=vUV-.5; float v=smoothstep(.85,.2,length(q*vec2(1.1,1.)))*uVig+(1.-uVig); c=mix(uVigCol,c,v);
    float g=fract(sin(dot(vUV*1000.+uTime,vec2(12.9898,78.233)))*43758.5453); c+=(g-.5)*uGrain;
    o=vec4(c,1.); }`;
  R4.COPY_FS=`#version 300 es
  precision highp float; in vec2 vUV; out vec4 o; uniform sampler2D uTex; void main(){ o=texture(uTex,vUV); }`;
})();
