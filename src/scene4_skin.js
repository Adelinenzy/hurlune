/* ===================== R4 : personnages réalistes (Grab3D, CC0) avec squelette ===================== */
(function(){
  "use strict";
  const {M}=R4;
  R4.CHAR_LIST=["medieval-villager","farmer","farmer-woman","witch","plague-doctor","hooded-rogue","elderly-woman","elderly-man","leather-armor-warrior","armored-knight","king","queen","dwarf","elf","pirate","vampire"];
  R4.CHARS={}; const waiters={}, loading={};
  window.HURLUNE_CHAR=function(d){ R4.CHARS[d.slug]=d; (waiters[d.slug]||[]).forEach(f=>f[0](d)); delete waiters[d.slug]; };
  R4.charSlug=av=>{ const i=av&&av.rc; return i!=null&&i>=0?R4.CHAR_LIST[i%R4.CHAR_LIST.length]:null; };
  R4.loadChar=function(slug){
    if(R4.CHARS[slug]) return Promise.resolve(R4.CHARS[slug]);
    return new Promise((res,rej)=>{
      (waiters[slug]=waiters[slug]||[]).push([res,rej]);
      if(loading[slug]) return; loading[slug]=true;
      const s=document.createElement("script"); s.src="chars/"+slug+".js"; s.async=true;
      s.onerror=()=>{ loading[slug]=false; (waiters[slug]||[]).forEach(f=>f[1](new Error("char "+slug))); delete waiters[slug]; };
      document.head.appendChild(s);
    });
  };

  /* ---------- quaternions ---------- */
  const qmul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
  const qinv=q=>[-q[0],-q[1],-q[2],q[3]];
  const qax=(x,y,z,a)=>{ const s=Math.sin(a/2); return [x*s,y*s,z*s,Math.cos(a/2)]; };
  const qeul=(e)=>qmul(qax(0,1,0,e[1]),qmul(qax(1,0,0,e[0]),qax(0,0,1,e[2]))); // Ry*Rx*Rz, comme M.rot3
  const qrot=(q,v)=>{ const u=[q[0],q[1],q[2]], s=q[3]; const c=R4.cross(u,v); const c2=R4.cross(u,c); return [v[0]+2*(s*c[0]+c2[0]), v[1]+2*(s*c[1]+c2[1]), v[2]+2*(s*c[2]+c2[2])]; };
  function qfromto(a,b){ a=R4.nrm(a); b=R4.nrm(b); const d=R4.dot(a,b); if(d<-.9999){ return [1,0,0,0]; } const c=R4.cross(a,b); const q=[c[0],c[1],c[2],1+d]; const l=Math.hypot(...q); return q.map(x=>x/l); }
  function mtrs(t,q,s){ const [x,y,z,w]=q, o=new Float32Array(16);
    o[0]=(1-2*(y*y+z*z))*s[0]; o[1]=2*(x*y+z*w)*s[0]; o[2]=2*(x*z-y*w)*s[0];
    o[4]=2*(x*y-z*w)*s[1]; o[5]=(1-2*(x*x+z*z))*s[1]; o[6]=2*(y*z+x*w)*s[1];
    o[8]=2*(x*z+y*w)*s[2]; o[9]=2*(y*z-x*w)*s[2]; o[10]=(1-2*(x*x+y*y))*s[2];
    o[12]=t[0]; o[13]=t[1]; o[14]=t[2]; o[15]=1; return o; }
  function mul4(a,b,o){ for(let i=0;i<4;i++)for(let j=0;j<4;j++){ let s=0; for(let k=0;k<4;k++) s+=a[k*4+j]*b[i*4+k]; o[i*4+j]=s; } return o; }

  /* ---------- squelette préparé (une fois par personnage) ---------- */
  const MAP={pelvis:["Hips",1],neck:["neck",1],head:["Head",1],shL:["LeftArm",1],shR:["RightArm",1],elL:["LeftForeArm",1],elR:["RightForeArm",1],hipL:["LeftUpLeg",1],hipR:["RightUpLeg",1],knL:["LeftLeg",1],knR:["RightLeg",1]};
  const rigs={};
  R4.charRig=function(slug){
    if(rigs[slug]) return rigs[slug]; const d=R4.CHARS[slug]; if(!d) return null;
    const B=d.bones, n=B.length, id={}; B.forEach((b,i)=>id[b.n]=i);
    let root=Float32Array.from(d.root);
    const ibm=[]; for(let i=0;i<n;i++) ibm.push(Float32Array.from(d.ibm.slice(i*16,i*16+16)));
    // positions/rotations du monde au repos
    const fk=(locQ)=>{ const W=[], R=[]; for(let i=0;i<n;i++){ const b=B[i]; const L=mtrs(b.t,locQ[i],b.s); W[i]=b.p<0?mul4(root,L,new Float32Array(16)):mul4(W[b.p],L,new Float32Array(16)); R[i]=b.p<0?locQ[i]:qmul(R[b.p],locQ[i]); } return {W,R}; };
    const pos=m=>[m[12],m[13],m[14]];
    let locQ=B.map(b=>b.r.slice());
    let rest=fk(locQ);
    // orientation : le personnage doit regarder vers +Z
    if(id.headfront!=null&&id.Head!=null){ const f=R4.sub(pos(rest.W[id.headfront]),pos(rest.W[id.Head])); if(f[2]<0&&Math.abs(f[2])>Math.abs(f[0])){ root=mul4(mtrs([0,0,0],[0,1,0,0],[1,1,1]),root,new Float32Array(16)); rest=fk(locQ); } }
    // corrections de pose A -> bras et jambes droits vers le bas
    const fix=(bone,child,target)=>{ const i=id[bone], c=id[child]; if(i==null||c==null) return;
      const cur=fk(locQ); const dir=R4.sub(pos(cur.W[c]),pos(cur.W[i])); const dq=qfromto(dir,target);
      const A=cur.R[i]; locQ[i]=qmul(locQ[i],qmul(qinv(A),qmul(dq,A))); };
    fix("LeftArm","LeftForeArm",[.12,-1,0]); fix("RightArm","RightForeArm",[-.12,-1,0]);
    fix("LeftForeArm","LeftHand",[.08,-1,.04]); fix("RightForeArm","RightHand",[-.08,-1,.04]);
    fix("LeftUpLeg","LeftLeg",[.04,-1,0]); fix("RightUpLeg","RightLeg",[-.04,-1,0]);
    fix("LeftLeg","LeftFoot",[0,-1,0]); fix("RightLeg","RightFoot",[0,-1,0]);
    const base=fk(locQ);
    const hipsY=pos(base.W[id.Hips])[1];
    const rig={slug,n,B,id,root,ibm,locQ,A:base.R,hipsY,head:id.Head,hand:id.RightHand,
      sp:[id.Spine02,id.Spine01].filter(x=>x!=null), mats:new Float32Array(n*16), W:[]};
    return rigs[slug]=rig;
  };
  // pose (même format que les personnages en pâte) -> matrices de peau
  const I=[0,0,0,1];
  R4.charPose=function(rig,pose){
    const {n,B,id,locQ,A}=rig; const D=new Array(n).fill(null);
    for(const k in MAP){ const e=pose[k]; if(!e) continue; const i=id[MAP[k][0]]; if(i!=null) D[i]=qeul(e); }
    if(pose.spine&&rig.sp.length){ const e=pose.spine.map(x=>x/rig.sp.length); for(const i of rig.sp) D[i]=qeul(e); }
    const W=rig.W, tmp=new Float32Array(16);
    for(let i=0;i<n;i++){ const b=B[i]; let q=locQ[i]; if(D[i]) q=qmul(q,qmul(qinv(A[i]),qmul(D[i],A[i])));
      const L=mtrs(b.t,q,b.s); W[i]=W[i]||new Float32Array(16); if(b.p<0) mul4(rig.root,L,W[i]); else mul4(W[b.p],L,W[i]);
      mul4(W[i],rig.ibm[i],tmp); rig.mats.set(tmp,i*16); }
    return rig.mats;
  };
  R4.charHead=rig=>{ const m=rig.W[rig.head]; return m?[m[12],m[13],m[14]]:[0,1.6,0]; };
  R4.charHand=rig=>{ const m=rig.W[rig.hand]; return m?[m[12],m[13],m[14]]:[0,1,0]; };

  /* ---------- GPU ---------- */
  const gpu=new WeakMap();
  function tex(gl,b64,srgb){
    const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(srgb?[200,190,180,255]:[128,128,255,255]));
    let pr=Promise.resolve();
    if(b64){ const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); pr=createImageBitmap(new Blob([bin],{type:"image/jpeg"})).then(img=>{
      gl.bindTexture(gl.TEXTURE_2D,t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,srgb?gl.SRGB8_ALPHA8:gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,img); gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR); const af=gl.getExtension("EXT_texture_filter_anisotropic"); if(af) gl.texParameterf(gl.TEXTURE_2D,af.TEXTURE_MAX_ANISOTROPY_EXT,4); img.close&&img.close(); }).catch(()=>{}); }
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    tex.last=pr; return t; }
  R4.charGPU=function(gl,slug){
    let m=gpu.get(gl); if(!m){ m={}; gpu.set(gl,m); } if(m[slug]) return m[slug];
    const d=R4.CHARS[slug]; if(!d) return null;
    const bin=Uint8Array.from(atob(d.bin),c=>c.charCodeAt(0)).buffer; const nv=d.nv; let o=0;
    const take=(bytes)=>{ const s=o; o+=bytes; return s; };
    const oP=take(nv*12), oN=take(nv*4), oU=take(nv*4), oJ=take(nv*4), oW=take(nv*4), oI=take(d.ni*(d.i32?4:2));
    const vao=gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,vb); gl.bufferData(gl.ARRAY_BUFFER,new Uint8Array(bin,0,oI),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,oP);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.BYTE,true,4,oN);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,2,gl.UNSIGNED_SHORT,true,0,oU);
    gl.enableVertexAttribArray(3); gl.vertexAttribIPointer(3,4,gl.UNSIGNED_BYTE,0,oJ);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4,4,gl.UNSIGNED_BYTE,true,0,oW);
    const ib=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint8Array(bin,oI,d.ni*(d.i32?4:2)),gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    const alb=tex(gl,d.tc,true), p1=tex.last, nrm=tex(gl,d.tn,false), p2=tex.last;
    return m[slug]={vao,n:d.ni,type:d.i32?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,alb,nrm,ready:Promise.all([p1,p2])};
  };

  /* ---------- shader de peau (squelette) ---------- */
  R4.SKIN_VS=`#version 300 es
  layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec2 aUV; layout(location=3) in uvec4 aJ; layout(location=4) in vec4 aW;
  uniform mat4 uVP,uM; uniform mat4 uB[24];
  out vec3 vW; out vec3 vN; out vec4 vC; out vec2 vUV;
  void main(){ mat4 S=uB[aJ.x]*aW.x+uB[aJ.y]*aW.y+uB[aJ.z]*aW.z+uB[aJ.w]*aW.w;
    vec4 w=uM*S*vec4(aP,1.); vW=w.xyz; vN=mat3(uM)*mat3(S)*aN; vC=vec4(1.,1.,1.,11.); vUV=aUV; gl_Position=uVP*w; }`;
})();
