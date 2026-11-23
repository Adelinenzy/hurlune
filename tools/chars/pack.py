import json,base64,io,sys,os
from PIL import Image
src='/tmp/chars'; out=sys.argv[1]; os.makedirs(out,exist_ok=True)
tot=0
for f in sorted(os.listdir(src)):
    if not f.endswith('.json'): continue
    slug=f[:-5]; j=json.load(open(f'{src}/{f}'))
    def tex(suf,size,q):
        p=f'{src}/{slug}_{suf}.jpg'
        if not os.path.exists(p): return None
        im=Image.open(p).convert('RGB'); 
        if im.width>size: im=im.resize((size,size),Image.LANCZOS)
        b=io.BytesIO(); im.save(b,'JPEG',quality=q,optimize=True,progressive=False); return base64.b64encode(b.getvalue()).decode()
    j['tc']=tex('c',1024,84); j['tn']=tex('n',512,86)
    j['bin']=base64.b64encode(open(f'{src}/{slug}.bin','rb').read()).decode()
    s='HURLUNE_CHAR('+json.dumps(j,separators=(',',':'))+');\n'
    open(f'{out}/{slug}.js','w').write(s); tot+=len(s); print(slug, len(s)//1024,'KB')
print('total',tot//1024,'KB')
