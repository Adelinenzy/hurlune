# Compacte une sélection du "Stylized Nature MegaKit" (Quaternius, CC0) pour Hurlune.
import json,base64,io,os,sys,struct
import numpy as np
from PIL import Image
SRC=sys.argv[1]; OUT=sys.argv[2]
G=SRC+'/glTF'; T=SRC+'/Textures'
MODELS=['Pine_1','Pine_2','Pine_3','Pine_4','Pine_5','CommonTree_1','CommonTree_2','CommonTree_3','CommonTree_4','CommonTree_5',
 'DeadTree_1','DeadTree_2','DeadTree_3','TwistedTree_1','TwistedTree_3','Rock_Medium_1','Rock_Medium_2','Rock_Medium_3',
 'Bush_Common','Bush_Common_Flowers','Fern_1','Plant_1','Plant_1_Big','Plant_7','Grass_Common_Short','Grass_Common_Tall','Grass_Wispy_Short',
 'Flower_3_Group','Flower_4_Group','Mushroom_Common','Mushroom_Laetiporus','Pebble_Round_1','Pebble_Round_2','Clover_1']
TEXSIZE={'Bark_NormalTree':512,'Bark_DeadTree':512,'Bark_TwistedTree':512,'Rocks_Diffuse':1024,'PathRocks_Diffuse':512,'Leaves':1024,'Flowers':512,'Mushrooms':512,'Grass':256}
CT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
def acc(j,bins,i):
    a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]; dt=np.dtype(CT[a['componentType']]); n=NC[a['type']]
    b=bins[bv['buffer']]; off=bv.get('byteOffset',0)+a.get('byteOffset',0); st=bv.get('byteStride',n*dt.itemsize)
    raw=np.frombuffer(b,dtype=np.uint8,count=st*(a['count']-1)+n*dt.itemsize,offset=off)
    arr=np.lib.stride_tricks.as_strided(raw,shape=(a['count'],n*dt.itemsize),strides=(st,1)).copy().view(dt).reshape(a['count'],n)
    if a.get('normalized'): arr=arr.astype(np.float32)/np.iinfo(dt).max
    return arr
texs={}; mats={}; models={}
def tex(uri,alpha):
    name=uri[:-4]
    if name in texs: return name
    im=Image.open(T+'/'+uri); im=im.convert('RGBA' if alpha else 'RGB')
    s=TEXSIZE.get(name.replace('_Normal','').replace('_C',''),512)
    if '_Normal' in name: s=min(s,512)
    if im.width>s: im=im.resize((s,s),Image.LANCZOS)
    b=io.BytesIO()
    if alpha: im.save(b,'WEBP',quality=88,method=6)
    else: im.save(b,'JPEG',quality=85,optimize=True)
    texs[name]=('image/webp' if alpha else 'image/jpeg',base64.b64encode(b.getvalue()).decode()); return name
for m in MODELS:
    j=json.load(open(f'{G}/{m}.gltf')); bins=[open(f"{G}/{bf['uri']}",'rb').read() for bf in j['buffers']]
    prims=[]
    for p in j['meshes'][0]['primitives']:
        mt=j['materials'][p['material']]; A=p['attributes']
        pos=acc(j,bins,A['POSITION']).astype(np.float32); nrm=acc(j,bins,A['NORMAL']); uv=acc(j,bins,A['TEXCOORD_0']).astype(np.float32)
        col=acc(j,bins,A['COLOR_0'])[:,:3] if 'COLOR_0' in A else np.ones((len(pos),3),np.float32)
        if col.dtype!=np.float32: col=col.astype(np.float32)/(np.iinfo(col.dtype).max)
        idx=acc(j,bins,p['indices']).reshape(-1).astype(np.uint32)
        alpha=mt.get('alphaMode')=='MASK' and 'Bark' not in mt['name']
        bc=j['images'][j['textures'][mt['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]['uri']
        if bc=='Leaves_TwistedTree_C.png': bc='Leaves_TwistedTree.png'
        nt=mt.get('normalTexture'); nn=j['images'][j['textures'][nt['index']]['source']]['uri'] if nt else None
        mk=mt['name']
        if mk not in mats: mats[mk]={'c':tex(bc,alpha),'n':tex(nn,False) if nn else None,'a':1 if alpha else 0,'leaf':1 if ('Leaves' in mk or 'Leaf' in mk or mk in('Grass','Flowers')) else 0,'rock':1 if 'Rock' in mk else 0}
        n8=np.clip(np.round(nrm*127),-127,127).astype(np.int8); n8=np.hstack([n8,np.zeros((len(n8),1),np.int8)])
        c8=np.clip(np.round(col*255),0,255).astype(np.uint8); c8=np.hstack([c8,np.full((len(c8),1),255,np.uint8)])
        q=lambda v,lo,hi: np.round((v-lo)/np.maximum(hi-lo,1e-6)*65535).astype(np.uint16)
        pl,ph=pos.min(0),pos.max(0); ul,uh=uv.min(0),uv.max(0)
        buf=q(pos,pl,ph).tobytes()+n8.tobytes()+q(uv,ul,uh).tobytes()+c8.tobytes()+(idx.astype(np.uint16) if len(pos)<65536 else idx).tobytes()
        prims.append({'m':mk,'nv':len(pos),'ni':len(idx),'i32':len(pos)>=65536,'b':base64.b64encode(buf).decode(),
                      'pl':pl.tolist(),'ph':ph.tolist(),'ul':ul.tolist(),'uh':uh.tolist()})
    models[m]=prims
data={'tex':{k:{'t':v[0],'d':v[1]} for k,v in texs.items()},'mats':mats,'models':models}
s='HURLUNE_KIT("nature",'+json.dumps(data,separators=(',',':'))+');\n'
open(OUT,'w').write(s)
print('size',len(s)//1024,'KB', 'tex',sum(len(v[1]) for v in texs.values())//1024,'KB')
for m,ps in models.items(): pass
