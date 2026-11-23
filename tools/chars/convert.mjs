// Allège un personnage Grab3D (GLB riggé) : maillage simplifié + données compactes pour Hurlune.
import fs from "fs";
import { MeshoptSimplifier as MS } from "./meshopt_simplifier.module.js";
const [,, inp, outDir, slug, TRI="14000"] = process.argv;
const buf = fs.readFileSync(inp);
const jl = buf.readUInt32LE(12); const J = JSON.parse(buf.slice(20, 20 + jl).toString());
const binOff = 20 + jl + 8; const BIN = buf.slice(binOff);
const CT = {5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
const NC = {SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
function acc(i){ const a=J.accessors[i], bv=J.bufferViews[a.bufferView]; const T=CT[a.componentType], n=NC[a.type];
  const off=(bv.byteOffset||0)+(a.byteOffset||0); const stride=bv.byteStride||n*T.BYTES_PER_ELEMENT;
  const out=new T(a.count*n); const src=Buffer.from(BIN.buffer,BIN.byteOffset+off);
  for(let k=0;k<a.count;k++) for(let c=0;c<n;c++){ const o=k*stride+c*T.BYTES_PER_ELEMENT;
    out[k*n+c]= T===Float32Array?src.readFloatLE(o):T===Uint8Array?src.readUInt8(o):T===Uint16Array?src.readUInt16LE(o):T===Uint32Array?src.readUInt32LE(o):T===Int8Array?src.readInt8(o):src.readInt16LE(o); }
  return {d:out,n,norm:a.normalized}; }
// --- maths matrices (column-major) ---
const mul=(a,b)=>{ const o=new Float64Array(16); for(let i=0;i<4;i++)for(let j=0;j<4;j++){ let s=0; for(let k=0;k<4;k++) s+=a[k*4+j]*b[i*4+k]; o[i*4+j]=s; } return o; };
const I4=()=>{ const m=new Float64Array(16); m[0]=m[5]=m[10]=m[15]=1; return m; };
function trs(n){ if(n.matrix) return Float64Array.from(n.matrix); const t=n.translation||[0,0,0], q=n.rotation||[0,0,0,1], s=n.scale||[1,1,1];
  const [x,y,z,w]=q; const m=I4(); m[0]=(1-2*(y*y+z*z))*s[0]; m[1]=2*(x*y+z*w)*s[0]; m[2]=2*(x*z-y*w)*s[0];
  m[4]=2*(x*y-z*w)*s[1]; m[5]=(1-2*(x*x+z*z))*s[1]; m[6]=2*(y*z+x*w)*s[1]; m[8]=2*(x*z+y*w)*s[2]; m[9]=2*(y*z-x*w)*s[2]; m[10]=(1-2*(x*x+y*y))*s[2]; m[12]=t[0]; m[13]=t[1]; m[14]=t[2]; return m; }
const parent={}; J.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parent[c]=i));
const world=i=>{ let m=trs(J.nodes[i]); let p=parent[i]; while(p!=null){ m=mul(trs(J.nodes[p]),m); p=parent[p]; } return m; };
const meshNode=J.nodes.findIndex(n=>n.mesh!=null&&n.skin!=null); const skin=J.skins[J.nodes[meshNode].skin];
const joints=skin.joints; const jidx={}; joints.forEach((j,i)=>jidx[j]=i);
const prim=J.meshes[J.nodes[meshNode].mesh].primitives[0], A=prim.attributes;
const P=acc(A.POSITION).d, N=acc(A.NORMAL).d, UV=acc(A.TEXCOORD_0).d, JO=acc(A.JOINTS_0), WE=acc(A.WEIGHTS_0);
let IDX=acc(prim.indices).d; IDX=Uint32Array.from(IDX);
const nv=P.length/3;
// --- simplification avec attributs (normales + UV) ---
await MS.ready;
const NB=Math.min(24,joints.length), ST=5+NB; const attr=new Float32Array(nv*ST);
for(let i=0;i<nv;i++){ const o=i*ST; attr[o]=N[i*3]; attr[o+1]=N[i*3+1]; attr[o+2]=N[i*3+2]; attr[o+3]=UV[i*2]; attr[o+4]=UV[i*2+1];
  for(let c=0;c<4;c++){ const jn=JO.d[i*4+c]; const w=WE.d instanceof Float32Array?WE.d[i*4+c]:WE.d[i*4+c]/255; if(jn<NB) attr[o+5+jn]+=w; } }
const target=Math.min(IDX.length,(+TRI)*3);
const aw=[.3,.3,.3,1,1].concat(new Array(NB).fill(2));
let [ind,err]=MS.simplifyWithAttributes(IDX,Float32Array.from(P),3,attr,ST,aw,null,target,0.05);
const [remap,unique]=MS.compactMesh(ind);
const pos=new Float32Array(unique*3), nrm=new Int8Array(unique*4), uv=new Uint16Array(unique*2), jo=new Uint8Array(unique*4), we=new Uint8Array(unique*4);
for(let i=0;i<nv;i++){ const t=remap[i]; if(t===0xffffffff) continue;
  pos.set(P.subarray(i*3,i*3+3),t*3);
  for(let c=0;c<3;c++) nrm[t*4+c]=Math.max(-127,Math.min(127,Math.round(N[i*3+c]*127)));
  uv[t*2]=Math.round(Math.max(0,Math.min(1,UV[i*2]))*65535); uv[t*2+1]=Math.round(Math.max(0,Math.min(1,UV[i*2+1]))*65535);
  let ws=[0,0,0,0]; for(let c=0;c<4;c++){ jo[t*4+c]=JO.d[i*4+c]; ws[c]=WE.norm||WE.d instanceof Float32Array?(WE.d instanceof Float32Array?WE.d[i*4+c]:WE.d[i*4+c]/255):WE.d[i*4+c]; }
  const s=ws.reduce((a,b)=>a+b,0)||1; let q=ws.map(w=>Math.round(w/s*255)); const d=255-q.reduce((a,b)=>a+b,0); q[q.indexOf(Math.max(...q))]+=d; for(let c=0;c<4;c++) we[t*4+c]=q[c]; }
// --- squelette ---
const ibm=acc(skin.inverseBindMatrices).d;
// mise à l'échelle : hauteur 1,72 m, pieds à y=0 (positions de liaison = monde au repos)
const ibm0=Float64Array.from(acc(skin.inverseBindMatrices).d.slice(0,16)); const meshW=mul(world(joints[0]),ibm0); console.log('meshNodeW scale',world(meshNode)[0].toFixed(4),'bind scale',meshW[0].toFixed(4), meshW[5].toFixed(4)); // positions du maillage dans l'espace du nœud ; on calcule les positions au repos via jointWorld*IBM (≈ meshW)
let minY=1e9,maxY=-1e9; for(let i=0;i<unique;i++){ const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2]; const wy=meshW[1]*x+meshW[5]*y+meshW[9]*z+meshW[13]; minY=Math.min(minY,wy); maxY=Math.max(maxY,wy); }
const hh=maxY-minY; const sc=Math.min(1.84,Math.max(1.5,hh))/hh;
const rootJ=joints.find(j=>parent[j]==null||jidx[parent[j]]==null);
let anc=I4(); { let p=parent[rootJ]; const ch=[]; while(p!=null){ ch.unshift(p); p=parent[p]; } for(const a of ch) anc=mul(anc,trs(J.nodes[a])); }
const fix=I4(); fix[0]=fix[5]=fix[10]=sc; fix[13]=-minY*sc;
const rootM=mul(fix,anc);
const bones=joints.map((j,i)=>{ const n=J.nodes[j]; return {n:n.name,p:jidx[parent[j]]!=null?jidx[parent[j]]:-1,t:n.translation||[0,0,0],r:n.rotation||[0,0,0,1],s:n.scale||[1,1,1]}; });
// --- textures ---
const mat=J.materials[prim.material||0]; const img=k=>{ const ti=k&&k.index; if(ti==null) return null; const im=J.images[J.textures[ti].source]; const bv=J.bufferViews[im.bufferView]; return BIN.slice(bv.byteOffset||0,(bv.byteOffset||0)+bv.byteLength); };
fs.mkdirSync(outDir,{recursive:true});
const bc=img(mat.pbrMetallicRoughness&&mat.pbrMetallicRoughness.baseColorTexture), nm=img(mat.normalTexture), mr=img(mat.pbrMetallicRoughness&&mat.pbrMetallicRoughness.metallicRoughnessTexture);
if(bc) fs.writeFileSync(`${outDir}/${slug}_c.jpg`,bc); if(nm) fs.writeFileSync(`${outDir}/${slug}_n.jpg`,nm); if(mr) fs.writeFileSync(`${outDir}/${slug}_mr.jpg`,mr);
// --- binaire ---
const idx16=unique<65536; const ib=idx16?Uint16Array.from(ind):Uint32Array.from(ind);
const parts=[pos,nrm,uv,jo,we,ib]; const tot=parts.reduce((a,p)=>a+p.byteLength,0); const out=Buffer.alloc(tot); let o=0; for(const p of parts){ Buffer.from(p.buffer,p.byteOffset,p.byteLength).copy(out,o); o+=p.byteLength; }
fs.writeFileSync(`${outDir}/${slug}.bin`,out);
fs.writeFileSync(`${outDir}/${slug}.json`,JSON.stringify({slug,nv:unique,ni:ind.length,i32:!idx16,bones,ibm:Array.from(ibm).map(x=>+x.toFixed(6)),root:Array.from(rootM).map(x=>+x.toFixed(6)),err:+err.toFixed(4)}));
console.log(slug,"verts",nv,"->",unique,"tris",IDX.length/3,"->",ind.length/3,"err",err.toFixed(4),"scale",sc.toFixed(5),"bin",(tot/1024|0)+"KB");
