/* ===================== R4 : décors ===================== */
(function(){
  "use strict";
  const {Geo,hash,fbm,nrm,lerp3,clamp,smooth}=R4;
  const L=h=>{ const n=parseInt(h.slice(1),16); return [((n>>16)/255)**2.2,(((n>>8)&255)/255)**2.2,((n&255)/255)**2.2]; };
  const lin=c=>c.map(x=>x**2.2);
  R4.lin=lin; R4.hexLin=L;
  const GROUND=4, ROCK=5, LEAF=6, BARK=7, CLOTH=9, WIN=1, EMIS=2;

  function ground(g,th){
    const N=110,S=150,X={p:v=>v,n:v=>v};
    const hgt=(x,z)=>{ const r=Math.hypot(x,z); const base=(fbm(x*.045,0,z*.045,3)-.5)*5+(fbm(x*.15,3,z*.15,2)-.5)*.8; return r<15?0:base*Math.min(1,(r-15)/14)+(th==="camp"&&r>17?Math.max(0,(fbm(x*.03,9,z*.03,2)-.45))*14*Math.min(1,(r-17)/10):0); };
    for(let i=0;i<N;i++) for(let j=0;j<N;j++){
      const x0=-S/2+i*S/N,z0=-S/2+j*S/N,x1=x0+S/N,z1=z0+S/N;
      const P=[[x0,hgt(x0,z0),z0],[x1,hgt(x1,z0),z0],[x1,hgt(x1,z1),z1],[x0,hgt(x0,z1),z1]];
      const col=p=>{ const r=Math.hypot(p[0],p[2]); const n=fbm(p[0]*.2,1,p[2]*.2,2);
        let c;
        if(th==="village") c=r<12.8?lerp3(lin([.42,.39,.35]),lin([.36,.33,.3]),n):lerp3(lin([.26,.36,.18]),lin([.33,.4,.2]),n);
        else if(th==="winter") c=lerp3(lin([.86,.89,.95]),lin([.95,.97,1]),n);
        else if(th==="camp") c=lerp3(lin([.36,.29,.22]),lin([.28,.24,.18]),n);
        else c=lerp3(lin([.2,.3,.12]),lin([.28,.36,.15]),n);
        if(r<2.2&&th!=="winter") c=lerp3(lin([.17,.13,.1]),c,smooth(1.2,2.2,r));
        if(th==="winter"&&r<1.6) c=lerp3(lin([.2,.17,.15]),c,smooth(.9,1.6,r));
        return c; };
      const n1=nrm(R4.cross(R4.sub(P[3],P[0]),R4.sub(P[1],P[0])));
      g.v(P[0],n1,col(P[0]),GROUND); g.v(P[3],n1,col(P[3]),GROUND); g.v(P[2],n1,col(P[2]),GROUND);
      g.v(P[0],n1,col(P[0]),GROUND); g.v(P[2],n1,col(P[2]),GROUND); g.v(P[1],n1,col(P[1]),GROUND);
    }
    return hgt;
  }
  function conifer(g,x,y,z,s,seed,snow){
    const gc=lerp3(lin([.08,.2,.12]),lin([.12,.26,.14]),hash(seed));
    g.cyl({t:[x,y-.2,z],s:[s,s,s]},.13,.22,1.6,7,lin([.25,.17,.11]),BARK);
    for(let k=0;k<5;k++){ const yy=y+.9+k*1.05, r=(2.1-k*.38)*(.9+hash(seed+k)*.2);
      g.blob({t:[x,yy,z],s:[s*r,s*1.2,s*r]},.55,1,.25,2.5,seed+k*3,gc,LEAF,(p,n)=>snow&&n[1]>.2?lerp3(gc,lin([.9,.93,.98]),Math.min(1,n[1]*1.4)):lerp3(gc.map(v=>v*.6),gc.map(v=>v*1.25),(p[1]+.6)));
      g.cyl({t:[x,yy-.2,z],s:[s,s,s]},.0,r*.62,1.35,9,gc,LEAF); }
  }
  function leafy(g,x,y,z,s,seed,snow){
    const gc=lerp3(lin([.16,.3,.1]),lin([.3,.38,.12]),hash(seed*1.3));
    g.cyl({t:[x,y-.2,z],s:[s,s,s],r:[hash(seed)*.1,0,hash(seed+1)*.1]},.12,.24,2.6,7,lin([.3,.22,.15]),BARK);
    for(let k=0;k<5;k++){ const a=hash(seed+k*7)*Math.PI*2, rr=k===0?0:.9+hash(seed+k)*.5;
      g.blob({t:[x+Math.sin(a)*rr*s,y+(2.9+hash(seed+k*3)*1.2)*s,z+Math.cos(a)*rr*s]},(1.15+hash(seed+k*5)*.5)*s,2,.38,1.6,seed*3+k,gc,LEAF,(p,n)=>{ const c=lerp3(gc.map(v=>v*.55),gc.map(v=>v*1.3),n[1]*.5+.5); return snow&&n[1]>.3?lerp3(c,lin([.92,.94,.98]),n[1]):c; }); }
  }
  function rock(g,x,y,z,s,seed,col,flat=.7){ g.blob({t:[x,y,z],r:[0,hash(seed)*6,0],s:[s,s*flat,s*(.8+hash(seed+2)*.4)]},1,2,.32,1.4,seed,col||lin([.42,.42,.4]),ROCK); }
  function house(g,k,a,r){
    const x=Math.sin(a)*r,z=Math.cos(a)*r,ry=a+Math.PI;
    const w=3.4+hash(k+1)*1.4,d=3.1,hh=2.7+hash(k+2)*1.2, wc=lin([[.86,.79,.64],[.8,.71,.55],[.88,.84,.74]][k%3]), rc=lin([[.5,.2,.15],[.38,.25,.18],[.3,.32,.4]][k%3]), tc=lin([.24,.15,.1]);
    const loc=(lx,ly,lz)=>{ const c=Math.cos(ry),s=Math.sin(ry); return [x+lx*c+lz*s,ly,z-lx*s+lz*c]; };
    g.box({t:loc(0,hh/2,0),r:[0,ry,0],s:[w,hh,d]},wc,CLOTH);
    g.box({t:loc(0,.3,0),r:[0,ry,0],s:[w+.12,.6,d+.12]},lin([.42,.4,.38]),ROCK);
    for(const lx of [-w/2,w/2,0]) g.box({t:loc(lx,hh/2,d/2+.03),r:[0,ry,0],s:[.16,hh,.08]},tc,BARK);
    g.box({t:loc(0,hh*.52,d/2+.03),r:[0,ry,0],s:[w,.14,.08]},tc,BARK);
    g.box({t:loc(-w*.22,.85,d/2+.04),r:[0,ry,0],s:[.8,1.7,.08]},lin([.3,.18,.1]),BARK);
    g.box({t:loc(w*.25,hh*.42+.35,d/2+.04),r:[0,ry,0],s:[.62,.58,.08]},lin([1,.68,.3]),WIN);
    g.box({t:loc(w*.25,hh*.42+.35,d/2+.08),r:[0,ry,0],s:[.06,.58,.04]},tc,BARK);
    g.prism({t:loc(0,hh,0),r:[0,ry,0],s:[w+.7,1.8,d+.8]},rc,CLOTH);
    g.box({t:loc(w*.28,hh+1.3,-.4),r:[0,ry,0],s:[.45,1.4,.45]},lin([.45,.32,.26]),ROCK);
  }

  R4.buildWorld=function(gl,th){
    const far=new Geo(), near=new Geo(); const snow=th==="winter";
    const hgt=ground(far,th);
    // feu : pierres, bûches, braises
    for(let i=0;i<12;i++){ const a=i/12*Math.PI*2; rock(near,Math.sin(a)*1.05,.08,Math.cos(a)*1.05,.2+hash(i)*.07,i*3.3,lin([.36,.35,.34]),.75); }
    for(let i=0;i<7;i++){ const a=i/7*Math.PI*2+.3; near.cyl({t:[Math.sin(a)*.62,.02,Math.cos(a)*.62],r:[.62,a+Math.PI,0]},.045,.07,1.25,7,lin([.28,.18,.1]),BARK,true,lin([.95,.35,.08])); }
    near.blob({t:[0,.04,0],s:[1,.25,1]},.6,2,.3,3,4,lin([1,.32,.06]),EMIS);
    // décor par thème
    if(th==="village"){
      for(let r=2.3;r<12.6;r+=.58){ const n=Math.floor(2*Math.PI*r/.62); for(let k=0;k<n;k++){ const a=k/n*Math.PI*2+r; const sh=.85+hash(r*7+k)*.25; far.box({t:[Math.sin(a)*r,.01,Math.cos(a)*r],r:[0,a,0],s:[.54,.04,.48]},lin([.44*sh,.41*sh,.37*sh]),ROCK); } }
      [0,1,2,3,4,6,7,8,9,10].forEach(k=>house(far,k,k/11*Math.PI*2+.1,17+hash(k)*2));
      { const a=5/11*Math.PI*2+.1,r=21,x=Math.sin(a)*r,z=Math.cos(a)*r; far.box({t:[x,3,z],r:[0,a,0],s:[4,6,5]},lin([.7,.68,.64]),ROCK); far.box({t:[x,5.5,z],r:[0,a,0],s:[2.2,11,2.2]},lin([.72,.7,.66]),ROCK); far.cyl({t:[x,11,z]},0,1.7,4.5,4,lin([.28,.28,.34]),CLOTH); far.box({t:[x+Math.sin(a+Math.PI)*1.12,8.4,z+Math.cos(a+Math.PI)*1.12],r:[0,a,0],s:[.8,1.1,.1]},lin([1,.72,.32]),WIN); }
      for(let i=0;i<70;i++){ const a=hash(i*3.7)*Math.PI*2,r=28+hash(i*5.1)*22; (i%3?conifer:leafy)(far,Math.sin(a)*r,hgt(Math.sin(a)*r,Math.cos(a)*r),Math.cos(a)*r,.9+hash(i*7.3)*.7,i,false); }
    } else {
      const ring=th==="camp"?16:11.5;
      for(let i=0;i<14;i++){ const a=hash(i*9.1)*Math.PI*2, r=6.5+hash(i*2.3)*5; rock(far,Math.sin(a)*r,.05,Math.cos(a)*r,.35+hash(i)*.55,i*7.1,null,.65); }
      const NT=th==="camp"?90:150;
      for(let i=0;i<NT;i++){ const a=hash(i*3.7)*Math.PI*2,r=ring+hash(i*5.1)*(th==="camp"?30:28); const x=Math.sin(a)*r,z=Math.cos(a)*r; const s=.85+hash(i*7.3)*.75;
        ((th==="forest"&&i%3===0)?leafy:conifer)(far,x,hgt(x,z),z,s,i+1,snow); }
      for(let i=0;i<40;i++){ const a=hash(i*5.9)*Math.PI*2,r=8+hash(i*1.9)*10; far.blob({t:[Math.sin(a)*r,.15,Math.cos(a)*r],s:[1,.6,1]},.45+hash(i)*.4,1,.3,2,i,snow?lin([.85,.88,.95]):lin([.16,.28,.1]),LEAF); }
      if(th==="camp"){ for(let i=0;i<9;i++){ const a=-.9+i*.22, r=19+hash(i)*3; rock(far,Math.sin(a)*r,0,Math.cos(a)*r,4.5+hash(i*3)*3.5,40+i*2.3,lin([.33,.31,.3]),1.25); } }
    }
    // montagnes
    for(let i=0;i<16;i++){ const a=i/16*Math.PI*2+hash(i)*.3,r=95+hash(i*2)*30; far.blob({t:[Math.sin(a)*r,-6,Math.cos(a)*r],s:[30+hash(i*3)*20,22+hash(i*4)*26,26]},1,2,.35,1.2,i*5,lin([.22,.25,.3]),ROCK,(p,n)=>(snow||p[1]>.55)&&n[1]>.2?lin([.85,.88,.94]):lin([.22,.25,.3])); }
    const lamps=th==="village"?[0,1,2,3].map(i=>{ const a=i/4*Math.PI*2+.4; return [Math.sin(a)*10.5,2.4,Math.cos(a)*10.5]; }):[];
    for(const p of lamps){ far.cyl({t:[p[0],0,p[2]]},.06,.08,2.3,8,lin([.15,.13,.12]),CLOTH); far.box({t:[p[0],p[1],p[2]],s:[.28,.34,.28]},lin([1,.62,.25]),EMIS); far.cyl({t:[p[0],2.56,p[2]]},0,.24,.25,4,lin([.15,.13,.12]),CLOTH); }
    return {far:R4.mesh(gl,far), near:R4.mesh(gl,near), lamps, hgt};
  };
  // bûche-banc pour chaque joueur
  R4.buildLog=function(gl){ const g=new Geo(); g.cyl({t:[-.55,.21,0],r:[0,0,-Math.PI/2]},.21,.22,1.1,12,lin([.36,.24,.15]),BARK,true,lin([.62,.48,.3])); return R4.mesh(gl,g); };
  R4.buildGrave=function(gl){ const g=new Geo();
    g.blob({t:[0,0,.25],s:[1.1,.32,1.6]},.45,1,.2,2,3,lin([.24,.17,.11]),GROUND);
    g.box({t:[0,.55,-.15],s:[.09,1.1,.09]},lin([.38,.26,.15]),BARK); g.box({t:[0,.82,-.15],s:[.5,.09,.09]},lin([.38,.26,.15]),BARK);
    for(let i=0;i<4;i++) g.sph({t:[-.2+i*.13,.1,.45+hash(i)*.1]},.05,6,4,lin([[.9,.3,.4],[.95,.8,.3],[.7,.5,.95],[1,1,1]][i]),CLOTH);
    return R4.mesh(gl,g); };
  R4.buildRing=function(gl){ const g=new Geo(); for(let i=0;i<40;i++){ const a0=i/40*Math.PI*2,a1=(i+1)/40*Math.PI*2; const p=(a,r)=>[Math.sin(a)*r,.02,Math.cos(a)*r]; const X={p:v=>v,n:v=>v};
    g.tri(X,p(a0,.55),p(a0,.68),p(a1,.68),[0,1,0],[0,1,0],[0,1,0],[1,.75,.3],EMIS); g.tri(X,p(a0,.55),p(a1,.68),p(a1,.55),[0,1,0],[0,1,0],[0,1,0],[1,.75,.3],EMIS); } return R4.mesh(gl,g); };
  R4.buildEyes=function(gl){ const g=new Geo(); for(const s of [-1,1]) g.sph({t:[s*.13,0,0],s:[1.3,.7,.5]},.055,8,6,[1,.75,.15],EMIS); return R4.mesh(gl,g); };
  R4.buildGrass=function(gl,count,th){
    if(th==="village"||th==="winter") count=Math.round(count*(th==="winter"?.15:.45));
    const blade=[]; const SEG=4; for(let i=0;i<SEG;i++){ const y0=i/SEG,y1=(i+1)/SEG,w0=.05*(1-y0),w1=.05*(1-y1); blade.push(-w0,y0,0, w0,y0,0, w1,y1,0, -w0,y0,0, w1,y1,0, -w1,y1,0); }
    const inst=[]; let n=0, tries=0;
    while(n<count&&tries<count*4){ tries++; const a=Math.random()*Math.PI*2, r=2.2+Math.pow(Math.random(),.75)*36; if(th==="village"&&r<13.4) continue; if(th==="camp"&&Math.random()<.55) continue;
      const x=Math.sin(a)*r,z=Math.cos(a)*r; const k=fbm(x*.12,5,z*.12,2); if(k<.35&&Math.random()<.6) continue;
      const base=th==="camp"?[.3,.32,.14]:[.2,.36,.1]; const c=lin(base.map((v,i)=>v*(.75+Math.random()*.5)+(i===0?k*.08:0)));
      inst.push(x,z,Math.random()*Math.PI,(.25+Math.random()*.35)*(.7+k*.8),c[0],c[1],c[2]); n++; }
    const vao=gl.createVertexArray(); gl.bindVertexArray(vao);
    const b1=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b1); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(blade),gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,12,0);
    const b2=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b2); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(inst),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3,4,gl.FLOAT,false,28,0); gl.vertexAttribDivisor(3,1);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4,3,gl.FLOAT,false,28,16); gl.vertexAttribDivisor(4,1);
    gl.bindVertexArray(null); return {vao,b:[b1,b2],n:blade.length/3,count:n};
  };
})();
