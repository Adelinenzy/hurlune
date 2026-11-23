# Assemble des maisons à partir du « Medieval Village MegaKit » (Quaternius, CC0) et les compacte pour Hurlune.
import json,base64,io,sys,math
import numpy as np
from PIL import Image
SRC=sys.argv[1]; OUT=sys.argv[2]
G=SRC+'/glTF'; T=SRC+'/Textures'
CT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
def acc(j,bins,i):
    a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]; dt=np.dtype(CT[a['componentType']]); n=NC[a['type']]
    b=bins[bv['buffer']]; off=bv.get('byteOffset',0)+a.get('byteOffset',0); st=bv.get('byteStride',n*dt.itemsize)
    raw=np.frombuffer(b,dtype=np.uint8,count=st*(a['count']-1)+n*dt.itemsize,offset=off)
    arr=np.lib.stride_tricks.as_strided(raw,shape=(a['count'],n*dt.itemsize),strides=(st,1)).copy().view(dt).reshape(a['count'],n)
    if a.get('normalized'): arr=arr.astype(np.float32)/np.iinfo(dt).max
    return arr
def quat_mat(q):
    x,y,z,w=q; return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]],np.float32)
cache={}; matinfo={}
def piece(name):
    if name in cache: return cache[name]
    j=json.load(open(f'{G}/{name}.gltf')); bins=[open(f"{G}/{b['uri']}",'rb').read() for b in j['buffers']]
    out=[]
    for ni,nd in enumerate(j['nodes']):
        if 'mesh' not in nd: continue
        R=quat_mat(nd.get('rotation',[0,0,0,1])); S=np.array(nd.get('scale',[1,1,1]),np.float32); Tr=np.array(nd.get('translation',[0,0,0]),np.float32)
        for p in j['meshes'][nd['mesh']]['primitives']:
            mt=j['materials'][p['material']]; A=p['attributes']
            pos=acc(j,bins,A['POSITION']).astype(np.float32)*S@R.T+Tr; nrm=acc(j,bins,A['NORMAL']).astype(np.float32)@R.T
            uv=acc(j,bins,A['TEXCOORD_0']).astype(np.float32) if 'TEXCOORD_0' in A else np.zeros((len(pos),2),np.float32)
            idx=acc(j,bins,p['indices']).reshape(-1).astype(np.uint32)
            mn=mt['name']
            if mn not in matinfo:
                pb=mt.get('pbrMetallicRoughness',{}); bt=pb.get('baseColorTexture'); nt=mt.get('normalTexture')
                matinfo[mn]={'c':j['images'][j['textures'][bt['index']]['source']]['uri'] if bt else None,'n':j['images'][j['textures'][nt['index']]['source']]['uri'] if nt else None,'f':pb.get('baseColorFactor'),'a':mt.get('alphaMode')}
            out.append((mn,pos,nrm,uv,idx))
    cache[name]=out; return out
def assemble(parts):
    groups={}
    for name,t,ry in parts:
        c,s=math.cos(ry),math.sin(ry)
        for mn,pos,nrm,uv,idx in piece(name):
            P=np.empty_like(pos); P[:,0]=t[0]+pos[:,0]*c+pos[:,2]*s; P[:,1]=t[1]+pos[:,1]; P[:,2]=t[2]-pos[:,0]*s+pos[:,2]*c
            N=np.empty_like(nrm); N[:,0]=nrm[:,0]*c+nrm[:,2]*s; N[:,1]=nrm[:,1]; N[:,2]=-nrm[:,0]*s+nrm[:,2]*c
            g=groups.setdefault(mn,[[],[],[],[],0]); g[0].append(P); g[1].append(N); g[2].append(uv); g[3].append(idx+g[4]); g[4]+=len(P)
    return {k:(np.vstack(v[0]),np.vstack(v[1]),np.vstack(v[2]),np.concatenate(v[3])) for k,v in groups.items()}
PI=math.pi
def house(W,D,floors,walls,roof,gable,door='Wall_Plaster_Door_Round',win='Wall_Plaster_Window_Wide_Round',upper=None,chimney=True):
    parts=[]
    for f in range(floors):
        y=f*3.0; wall=walls if f==0 else (upper or walls)
        sides=[('F',[(x,D/2) for x in np.arange(-W/2+1,W/2,2)],0),('B',[(x,-D/2) for x in np.arange(-W/2+1,W/2,2)],PI),
               ('R',[(W/2,z) for z in np.arange(-D/2+1,D/2,2)],PI/2),('L',[(-W/2,z) for z in np.arange(-D/2+1,D/2,2)],-PI/2)]
        for sd,pts,ry in sides:
            for i,(x,z) in enumerate(pts):
                mid=len(pts)//2
                if f==0 and sd=='F' and i==mid:
                    parts.append((door,[x,y,z],ry)); parts.append(('Door_1_Round',[x+ (-.53 if ry==0 else .53),y,z],ry))
                elif (i%2==(1 if len(pts)%2 else 0)) or (f>0 and i!=mid and sd in 'FB'):
                    parts.append((win,[x,y,z],ry)); parts.append(('Window_Wide_Round1',[x,y,z],ry)); parts.append(('WindowShutters_Wide_Round_Open',[x,y,z],ry))
                else: parts.append((wall,[x,y,z],ry))
                if f==0: parts.append(('Wall_BottomCover',[x,y,z],ry))
        for cx in (-W/2,W/2):
            for cz in (-D/2,D/2): parts.append(('Corner_Exterior_Wood',[cx,y,cz],0))
    top=floors*3.0
    parts.append((roof,[0,top,0],0))
    if gable: parts.append((gable,[0,top,D/2],0)); parts.append((gable,[0,top,-D/2],PI))
    if chimney: parts.append(('Prop_Chimney',[W/2-1.4,top+.6,-D/4],0))
    return parts
HOUSES={
 'House_A':house(6,8,1,'Wall_Plaster_WoodGrid','Roof_RoundTiles_6x8','Roof_Front_Brick6'),
 'House_B':house(4,6,2,'Wall_UnevenBrick_Straight','Roof_RoundTiles_4x6','Roof_Front_Brick4',door='Wall_UnevenBrick_Door_Round',win='Wall_UnevenBrick_Window_Wide_Round',upper='Wall_Plaster_WoodGrid'),
 'House_C':house(6,6,1,'Wall_UnevenBrick_Straight','Roof_RoundTiles_6x6','Roof_Front_Brick6',door='Wall_UnevenBrick_Door_Round',win='Wall_UnevenBrick_Window_Wide_Round'),
 'Tower':house(4,4,4,'Wall_UnevenBrick_Straight','Roof_Tower_RoundTiles',None,door='Wall_UnevenBrick_Door_Round',win='Wall_UnevenBrick_Window_Wide_Round',chimney=False),
 'House_D':house(6,8,2,'Wall_Plaster_Straight','Roof_RoundTiles_6x8','Roof_Front_Brick6',upper='Wall_Plaster_WoodGrid'),
}
PROPS={'Prop_Wagon':[('Prop_Wagon',[0,0,0],0)],'Prop_Crate':[('Prop_Crate',[0,0,0],0)],'Prop_Fence':[('Prop_WoodenFence_Single',[0,0,0],0),('Prop_WoodenFence_Single',[2.06,0,0],0)]}
texs={}
def tex(uri,size,normal=False,alpha=False):
    if not uri: return None
    name=uri.rsplit('.',1)[0]
    if name in texs: return name
    path=(T+'/Normals Godot-Unity/'+uri) if normal else (T+'/'+uri)
    import os
    if not os.path.exists(path): path=T+'/'+uri
    if not os.path.exists(path): return None
    im=Image.open(path)
    im=im.convert('RGBA' if alpha else 'RGB')
    if im.width>size: im=im.resize((size,int(size*im.height/im.width)),Image.LANCZOS)
    b=io.BytesIO()
    if alpha: im.save(b,'WEBP',quality=88,method=6); t='image/webp'
    else: im.save(b,'JPEG',quality=85,optimize=True); t='image/jpeg'
    texs[name]=(t,base64.b64encode(b.getvalue()).decode()); return name
models={}
for nm,parts in list(HOUSES.items())+list(PROPS.items()):
    grp=assemble(parts); prims=[]
    for mn,(pos,nrm,uv,idx) in grp.items():
        q=lambda v,lo,hi: np.round((v-lo)/np.maximum(hi-lo,1e-6)*65535).astype(np.uint16)
        pl,ph=pos.min(0),pos.max(0); ul,uh=uv.min(0),uv.max(0)
        n8=np.hstack([np.clip(np.round(nrm*127),-127,127).astype(np.int8),np.zeros((len(nrm),1),np.int8)])
        c8=np.full((len(pos),4),255,np.uint8)
        i32=len(pos)>=65536
        buf=q(pos,pl,ph).tobytes()+n8.tobytes()+q(uv,ul,uh).tobytes()+c8.tobytes()+(idx.astype(np.uint32) if i32 else idx.astype(np.uint16)).tobytes()
        prims.append({'m':mn,'nv':len(pos),'ni':len(idx),'i32':i32,'b':base64.b64encode(buf).decode(),'pl':pl.tolist(),'ph':ph.tolist(),'ul':ul.tolist(),'uh':uh.tolist()})
    models[nm]=prims; print(nm,sum(p['ni'] for p in prims)//3,'tris',[p['m'] for p in prims])
mats={}
used={p['m'] for ps in models.values() for p in ps}
for mn,mi in matinfo.items():
    if mn not in used: continue
    c=mi['c']; alpha=mi['a']=='MASK'
    if mn=='MI_WindowGlass': c='T_WindowGradient.png'
    mats[mn]={'c':tex(c,1024 if mn!='MI_Vine' else 256,alpha=alpha) if c else None,'n':tex(mi['n'],512,normal=True) if mi['n'] else None,'a':1 if alpha else 0,'leaf':0,'rock':0,'win':1 if mn=='MI_WindowGlass' else 0}
data={'tex':{k:{'t':v[0],'d':v[1]} for k,v in texs.items()},'mats':mats,'models':models}
s='HURLUNE_KIT("village",'+json.dumps(data,separators=(',',':'))+');\n'
open(OUT,'w').write(s); print('size',len(s)//1024,'KB tex',sum(len(v[1]) for v in texs.values())//1024,'KB')
