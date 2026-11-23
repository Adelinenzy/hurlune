/* ===================== R4 : personnages « pâte à modeler » ===================== */
(function(){
  "use strict";
  const {Geo,hash,nrm,clamp}=R4;
  const hx=h=>{ const n=parseInt(h.slice(1),16); return [((n>>16)/255)**2.2,(((n>>8)&255)/255)**2.2,((n&255)/255)**2.2]; }; // sRGB -> linéaire
  R4.PAL={
    skin:["#f6d2b8","#eebf9a","#d9a17a","#b97c55","#8d5a3b","#6a412a","#f3c9a8","#c98b66"],
    hair:["#2a1d15","#4a2c1a","#7a4a24","#a8642e","#c9a15a","#e6d28f","#b23a26","#d9d9de","#3b3f8f","#e07fb0"],
    cloth:["#b87a58","#e8d9a8","#2f4a8f","#7a2f3a","#3f6e4a","#5b3f86","#8a6a2f","#2e2e3a","#c35a3a","#2f7a8a","#e4e0d4","#9c3d7a","#55606e","#e0b84a"],
    boots:["#a0683e","#6b4226","#2a2228","#c8925c","#3a3a44","#8a2f2f","#d8c8a8"],
    eyes:["#3b6fb0","#4a8a4a","#6b4a2a","#2a2a2a","#7a8a9a","#9a6abf"]
  };
  R4.AV_FIELDS={s:8,fs:3,ey:6,gl:4,h2:10,hc:10,bd:4,a2:8,o2:5,t:14,t2:14,p:14,bt:7,bl:2,sc:3};
  // normalise un avatar (compatibilité avec l'ancien format 2D)
  R4.avNorm=function(av){
    av=Object.assign({},av||{}); const seed=JSON.stringify(av).split("").reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);
    const r=(k,n)=>Math.floor(hash(seed*.013+k)*n);
    if(av.h2==null) av.h2=[0,1,2,1,4,7][(av.h|0)%6];
    if(av.a2==null) av.a2=[0,2,1,5,4][(av.a|0)%5];
    if(av.o2==null) av.o2=[1,2,0,3][(av.o|0)%4];
    const F=R4.AV_FIELDS; const out={};
    for(const k in F){ let v=av[k]; if(v==null) v=k==="gl"?(r(3,9)<2?r(4,3)+1:0):k==="bd"?(r(5,9)<2?r(6,3)+1:0):k==="sc"?(r(7,9)<2?r(8,2)+1:0):k==="bl"?1:r(k.length*3+k.charCodeAt(0),F[k]); out[k]=((v|0)%F[k]+F[k])%F[k]; }
    if(av.s!=null) out.s=(av.s|0)%8; if(av.hc!=null) out.hc=(av.hc|0)%10; if(av.t!=null) out.t=(av.t|0)%14;
    return out;
  };
  R4.defaultAvatar=function(){ return {s:0,fs:0,ey:2,gl:1,h2:1,hc:2,bd:0,a2:0,o2:0,t:0,t2:1,p:1,bt:0,bl:1,sc:0,h:1,a:0,o:2,o_:0}; };
  R4.randomAvatar=function(){ const o={}; for(const k in R4.AV_FIELDS) o[k]=Math.floor(Math.random()*R4.AV_FIELDS[k]); if(Math.random()<.6) o.gl=0; if(Math.random()<.65) o.bd=0; if(Math.random()<.5) o.a2=0; if(Math.random()<.6) o.sc=0; o.bl=Math.random()<.75?1:0; o.h=o.h2%6; o.a=0; o.o=[2,0,1,3,0][o.o2]; o.hc%=8; return o; };

  /* Os (offsets locaux) */
  R4.BONES={ pelvis:[0,.5,0], spine:[0,0,0], neck:[0,.47,0], head:[0,.05,0], shL:[.205,.41,0], shR:[-.205,.41,0], elL:[0,-.25,0], elR:[0,-.25,0], hipL:[.095,-.02,.01], hipR:[-.095,-.02,.01], knL:[0,-.37,0], knR:[0,-.37,0] };
  R4.PARENT={ spine:"pelvis", neck:"spine", head:"neck", shL:"spine", shR:"spine", elL:"shL", elR:"shR", hipL:"pelvis", hipR:"pelvis", knL:"hipL", knR:"hipR" };

  R4.buildChar=function(gl,avIn){
    const av=R4.avNorm(avIn), P=R4.PAL;
    const sk=hx(P.skin[av.s]), skd=sk.map(x=>x*.82), hc=hx(P.hair[av.hc]), top=hx(P.cloth[av.t]), sec=hx(P.cloth[av.t2]), pants=hx(P.cloth[av.p]), boots=hx(P.boots[av.bt]);
    const dark=c=>c.map(x=>x*.6), SK=3, CL=9, HR=8, MT=10;
    const G={}; const g=k=>(G[k]=G[k]||new Geo());
    // ---- torse (os spine) ----
    const T=g("torso"); const o2=av.o2;
    const body = o2===4?sec:top;
    T.cyl({t:[0,0,0]},.165,.185,.27,18,body,CL);
    T.sph({t:[0,.3,0],s:[1.05,.95,.8]},.2,18,12,body,CL);
    for(const s of [-1,1]) T.sph({t:[s*.2,.4,0]},.08,12,8,o2===4?sec:top,CL);
    if(o2===4){ for(const s of [-1,1]) T.cyl({t:[s*.085,0,.02],r:[0,0,0],s:[1,1,.75]},.105,.12,.45,10,top,CL,false); }
    // jupe / pans
    const skirtLen=o2===2?.47:o2===1?.3:o2===3?.25:.16;
    T.cyl({t:[0,-skirtLen,0]},.188,o2===2?.42:o2===1?.3:.27,skirtLen+.02,20,top,CL,true);
    if(o2===0){ T.box({t:[0,.36,.165],r:[-.25,0,0],s:[.025,.13,.02]},dark(top),CL); for(const y of [.33,.39]) T.box({t:[0,y,.17],r:[-.25,0,0],s:[.07,.012,.012]},hx("#e8c98a"),CL); }
    if(o2===1){ for(const s of [-1,1]) T.box({t:[s*.07,.34,.15],r:[-.3,0,s*.25],s:[.06,.2,.02]},sec,CL); for(const y of [.06,.15,.24]) T.sph({t:[.035,y,.178]},.014,6,4,hx("#d8b85a"),MT); }
    if(o2===3||av.sc===2){ T.cyl({t:[0,-.42,-.06],s:[1,1,.8]},.23,.34,.86,18,av.sc===2?sec:dark(top),CL,false); }
    if(av.bl){ T.cyl({t:[0,-.015,0]},.193,.193,.05,20,hx("#2e2a2a"),CL); T.cyl({t:[0,-.002,.185],r:[Math.PI/2,0,0]},.028,.028,.012,12,hx("#c8c8cc"),MT); }
    if(av.sc===1){ T.torus({t:[0,.45,0]},.11,.04,16,8,sec,CL); T.box({t:[.05,.32,.16],r:[-.2,0,.15],s:[.06,.2,.03]},sec,CL); }
    T.cyl({t:[0,.44,0]},.07,.075,.08,12,sk,SK);
    // ---- tête (os head) ----
    const H=g("head"); const fs=[[1,1.06,1],[.93,1.16,.97],[1.08,.98,1.02]][av.fs];
    H.sph({t:[0,.21,0],s:fs},.21,24,18,sk,SK);
    H.sph({t:[0,.12,.06],s:[fs[0]*.82,.6,.85]},.2,18,10,sk,SK); // mâchoire
    for(const s of [-1,1]){ H.sph({t:[s*.205*fs[0],.2,0],s:[.45,.8,.65]},.06,10,8,skd,SK); H.sph({t:[s*.115,.155,.165],s:[1,.7,.5]},.035,8,6,[sk[0]*1.05,sk[1]*.72,sk[2]*.72],SK); }
    H.sph({t:[0,.19,.205],s:[.9,1.15,1.1]},.032,10,8,skd,SK);
    for(const s of [-1,1]) H.box({t:[s*.072,.29,.188],r:[-.2,0,s*-.12],s:[.06,.014,.02]},hc.map(x=>x*.8),HR);
    // barbe
    if(av.bd===1) H.sph({t:[0,.11,.05],s:[fs[0]*.86,.6,.9]},.205,16,10,[sk[0]*.78,sk[1]*.7,sk[2]*.68],SK);
    if(av.bd===2){ H.sph({t:[0,.08,.08],s:[fs[0]*.85,.72,.85]},.2,16,10,hc,HR); }
    if(av.bd>=2) H.sph({t:[0,.135,.2],s:[1.6,.45,.6]},.04,10,6,hc,HR);
    // cheveux
    const cap=(sy=.72,ex=.016,dy=0)=>H.sph({t:[0,.27+dy,-.015],s:[fs[0]*1.03,sy,1.05]},.215+ex,20,12,hc,HR);
    switch(av.h2){
      case 0: cap(); break;
      case 1: cap(.75); for(let i=0;i<7;i++){ const a=(i-3)*.32; H.sph({t:[Math.sin(a)*.15,.37+Math.cos(i)*.02,.11+Math.cos(a)*.06],r:[.6,a,0],s:[.7,.45,1.2]},.075,8,6,hc,HR); } break;
      case 2: cap(.8); H.sph({t:[0,.1,-.11],s:[1.08,1.45,.65]},.2,16,12,hc,HR); for(const s of [-1,1]) H.sph({t:[s*.19,.08,-.01],s:[.35,1.25,.6]},.12,10,8,hc,HR); break;
      case 3: cap(); H.sph({t:[0,.27,-.21]},.07,10,8,hc,HR); H.cyl({t:[0,.27,-.24],r:[2.7,0,0]},.035,.055,.3,10,hc,HR); break;
      case 4: cap(); H.sph({t:[0,.45,-.07]},.095,12,10,hc,HR); break;
      case 5: for(let i=0;i<22;i++){ const a=hash(i*3.1)*Math.PI*2, b=hash(i*7.7)*1.2; H.sph({t:[Math.sin(a)*Math.sin(b)*.2,.25+Math.cos(b)*.17,Math.cos(a)*Math.sin(b)*.2-.03]},.075,8,6,hc,HR); } break;
      case 6: cap(.55,.002); for(let i=0;i<6;i++) H.cyl({t:[0,.38+Math.sin(i/5*Math.PI)*.04,.15-i*.065],r:[-.3+i*.12,0,0]},0,.04,.14,6,hc,HR); break;
      case 7: break;
      case 8: cap(.82,.02); for(const s of [-1,1]) H.sph({t:[s*.17,.15,-.02],s:[.55,1.15,.95]},.13,12,10,hc,HR); H.sph({t:[0,.15,-.14],s:[1.2,1.1,.6]},.15,12,10,hc,HR); break;
      case 9: cap(); for(const s of [-1,1]){ H.cyl({t:[s*.2,.18,-.02],r:[0,0,s*.15]},.04,.05,.0001+0,8,hc,HR); for(let k=0;k<5;k++) H.sph({t:[s*(.2+k*.008),.15-k*.06,-.02]},.045-k*.003,8,6,hc,HR); } break;
    }
    // chapeaux
    switch(av.a2){
      case 1: H.sph({t:[0,.24,-.07],s:[1.12,1.15,.95]},.255,20,14,sec,CL); break;
      case 2: H.cyl({t:[0,.37,0]},.27,.27,.02,22,hx("#1d1a22"),CL); H.cyl({t:[0,.38,0]},.155,.16,.28,20,hx("#24212b"),CL); H.cyl({t:[0,.4,0]},.162,.162,.05,20,hx("#7a2f3a"),CL); break;
      case 3: H.cyl({t:[0,.36,0]},.29,.3,.02,22,hx("#3a2f5a"),CL); H.cyl({t:[0,.37,-.01],r:[-.15,0,.08]},0,.17,.5,20,hx("#3a2f5a"),CL); break;
      case 4: H.sph({t:[.02,.4,-.01],r:[0,0,.2],s:[1.15,.36,1.12]},.22,18,10,sec,CL); H.sph({t:[.02,.48,0]},.022,6,4,sec,CL); break;
      case 5: H.torus({t:[0,.35,-.01]},.19,.018,22,6,hx("#4f8a4a"),CL); for(let i=0;i<8;i++){ const a=i/8*Math.PI*2; H.sph({t:[Math.sin(a)*.19,.36,Math.cos(a)*.19-.01]},.035,8,6,hx(["#f2a0c0","#f7e17a","#a0d8f2","#ffffff"][i%4]),CL); } break;
      case 6: H.sph({t:[0,.3,-.01],s:[1.04,.62,1.04]},.228,18,10,top,CL); H.cyl({t:[0,.32,.14],r:[1.35,0,0],s:[1.25,1,.55]},.11,.11,.02,16,top,CL); break;
      case 7: H.torus({t:[0,.3,0],r:[.12,0,0]},.215,.022,22,6,hx("#b23a26"),CL); break;
    }
    // lunettes
    if(av.gl===1||av.gl===3){ const pos=av.gl===3?[-1]:[-1,1]; for(const s of pos) H.torus({t:[s*.075,.225,.205],r:[Math.PI/2,0,0]},.05,.0075,20,6,hx("#2a2a30"),MT); if(av.gl===1) H.box({t:[0,.232,.212],s:[.05,.008,.008]},hx("#2a2a30"),MT); for(const s of pos) H.box({t:[s*.15,.23,.1],s:[.008,.008,.2]},hx("#2a2a30"),MT); }
    if(av.gl===2){ for(const s of [-1,1]){ for(const [x,y,w,h] of [[0,.04,.1,.01],[0,-.035,.1,.01],[.05,0,.01,.08],[-.05,0,.01,.08]]) H.box({t:[s*.075+x,.225+y,.207],s:[w,h,.01]},hx("#1e1a1a"),MT); } H.box({t:[0,.24,.21],s:[.05,.01,.01]},hx("#1e1a1a"),MT); }
    // ---- yeux (os head, origine à hauteur des yeux) ----
    const E=g("eyes"); const ec=hx(P.eyes[av.ey]);
    for(const s of [-1,1]){ E.sph({t:[s*.075,0,0],s:[1,1.2,.55]},.042,14,10,[.95,.95,.95],MT); E.sph({t:[s*.075,0,.017],s:[1,1.15,.5]},.026,12,8,ec,MT); E.sph({t:[s*.075,0,.024],s:[1,1.1,.5]},.014,8,6,[.02,.02,.02],MT); E.sph({t:[s*.075+.009,.012,.03]},.006,6,4,[3,3,3],2); }
    // ---- bouche ----
    const Mo=g("mouth"); Mo.sph({t:[0,0,0],s:[1.35,.45,.45]},.03,12,8,[.35,.05,.06],CL);
    // ---- bras ----
    const sleeve=o2===0?sec:o2===4?sec:top;
    for(const [k,s] of [["uaL",1],["uaR",-1]]){ const A=g(k); A.cyl({t:[0,-.25,0]},.068,.06,.25,12,sleeve,CL); A.sph({t:[0,-.25,0]},.06,10,8,sleeve,CL); }
    for(const [k,s] of [["faL",1],["faR",-1]]){ const A=g(k); A.cyl({t:[0,-.2,0]},.06,.052,.2,12,sleeve,CL);
      if(o2===0||o2===1) A.cyl({t:[0,-.2,0]},.066,.066,.07,12,top,CL);
      A.sph({t:[0,-.255,.005],s:[.85,1.15,.7]},.058,12,10,sk,SK); A.sph({t:[s*-.04,-.235,.03],s:[.6,1,.6]},.025,8,6,sk,SK); }
    // ---- jambes ----
    for(const k of ["thL","thR"]){ const A=g(k); A.cyl({t:[0,-.37,0]},.085,.072,.37,12,pants,CL); A.sph({t:[0,0,0]},.088,10,8,pants,CL); A.sph({t:[0,-.37,0]},.074,10,8,pants,CL); }
    for(const k of ["shL","shR"]){ const A=g(k); A.cyl({t:[0,-.2,0]},.072,.064,.2,12,pants,CL); A.cyl({t:[0,-.36,0]},.075,.08,.18,12,boots,CL,true,boots.map(x=>x*1.1)); A.sph({t:[0,-.37,.06],s:[.9,.55,1.55]},.075,12,8,boots,CL); }
    const out={av}; for(const k in G) out[k]=R4.mesh(gl,G[k]); return out;
  };
  R4.freeChar=function(gl,c){ if(!c) return; for(const k in c) if(c[k]&&c[k].vao) R4.free(gl,c[k]); };
  // os -> partie
  R4.PARTS={ torso:"spine", head:"head", eyes:"head", mouth:"head", uaL:"shL", uaR:"shR", faL:"elL", faR:"elR", thL:"hipL", thR:"hipR", shL:"knL", shR:"knR" };
  R4.PART_OFF={ eyes:[0,.222,.188], mouth:[0,.112,.198] };
  const ORDER=["pelvis","spine","neck","head","shL","shR","elL","elR","hipL","hipR","knL","knR"];
  // calcule les matrices monde des os à partir d'une pose
  R4.skeleton=function(root,pose){
    const W={}; const B=R4.BONES, M=R4.M;
    for(const b of ORDER){ const r=pose[b]||[0,0,0]; let off=B[b]; if(b==="pelvis") off=[off[0]+(pose.px||0),off[1]+(pose.py||0),off[2]+(pose.pz||0)];
      const L=M.trs(off,r,1); W[b]=R4.PARENT[b]?M.mul(W[R4.PARENT[b]],L):M.mul(root,L); }
    return W;
  };
})();
