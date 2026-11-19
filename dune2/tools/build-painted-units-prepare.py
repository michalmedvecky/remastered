#!/usr/bin/env python3
"""Read-only extraction of all native world SHPs for hand-directed HD redraws."""
import base64,hashlib,importlib.util,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tools'))
from preload_data import verify_preload,read_pak
spec=importlib.util.spec_from_file_location('original_decoders',ROOT/'tools/build-hd-assets.py');dec=importlib.util.module_from_spec(spec);spec.loader.exec_module(dec)
OUT=ROOT/'art/hd-v2/units';(OUT/'native').mkdir(parents=True,exist_ok=True);(OUT/'references').mkdir(exist_ok=True);(OUT/'raw').mkdir(exist_ok=True)
sha=lambda data:hashlib.sha256(data).hexdigest();b64=lambda data:base64.b64encode(data).decode()
preload=verify_preload();members={}
for file in preload['files']:
 if file['name'].endswith('.PAK'):
  for name,row in read_pak(file['name']).items():members.setdefault(name,row)
palette=bytes((value*65)>>4 for value in members['IBM.PAL']['bytes']);frames={}
for name,base,count in [('UNITS2.SHP',111,40),('UNITS1.SHP',151,87),('UNITS.SHP',238,117)]:
 actual,rows=dec.shapes(members[name]['bytes']);assert actual==count
 for local,f in rows.items():
  gid=base+local;w,h=f['width'],f['height'];rgba=bytearray(w*h*4);xs=[];ys=[]
  for i,(code,mask) in enumerate(zip(f['indices'],f['mask'])):
   if not mask:continue
   index=f['palette'][code] if f['palette'] else code
   if 144<=index<=152:index+=16
   rgba[i*4:i*4+4]=palette[index*3:index*3+3]+b'\xff';xs.append(i%w);ys.append(i//w)
  path=OUT/'native'/f'{gid}.png';digest=dec.write_png(path,w,h,rgba)
  frames[gid]={'id':gid,'sourceW':w,'sourceH':h,'pivot':[w//2,h//2],'sourceInk':[min(xs),min(ys),max(xs)+1-min(xs),max(ys)+1-min(ys)]if xs else None,'sourceSHA256':f['sourceSHA256'],'sourceResource':name,'sourceFrame':local,'paletteMode':'local16'if f['palette'] else'global256','sourcePalette':f['palette'],'sourceIndicesBase64':b64(f['indices']),'sourceMaskBase64':b64(f['mask']),'nativePng':f'native/{gid}.png','nativePngSha256':digest}
inventory={'schema':1,'source':{'preloadSha256':preload['packageSha256'],'paletteSha256':sha(members['IBM.PAL']['bytes']),'resources':{name:sha(members[name]['bytes'])for name in ['UNITS2.SHP','UNITS1.SHP','UNITS.SHP']}},'palette':list(palette),'frames':frames}
(OUT/'inventory.json').write_text(json.dumps(inventory,indent=2)+'\n')
# Human inspection contact sheet, 12columns of separately enlarged exact frames.
cell=96;columns=12;rows=(len(frames)+columns-1)//columns;image=bytearray(columns*cell*rows*cell*4)
for slot,(gid,f)in enumerate(frames.items()):
 w,h,pixels=dec.read_png(OUT/f['nativePng']);scale=max(1,min(5,80//max(w,h)));left=slot%columns*cell+(cell-w*scale)//2;top=slot//columns*cell+(cell-h*scale)//2
 for y in range(h*scale):
  for x in range(w*scale):image[((top+y)*columns*cell+left+x)*4:((top+y)*columns*cell+left+x)*4+4]=pixels[((y//scale)*w+x//scale)*4:((y//scale)*w+x//scale)*4+4]
dec.write_png(OUT/'native-contact.png',columns*cell,rows*cell,image)
print(json.dumps({'frames':len(frames),'first':min(frames),'last':max(frames),'contact':str(OUT/'native-contact.png')}))
