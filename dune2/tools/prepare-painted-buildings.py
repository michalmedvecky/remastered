"""Prepare lossless native whole-building references; no original game execution."""
from pathlib import Path
import hashlib,importlib.util,json,struct,sys
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/hd-v2/buildings';REF=ART/'references';REF.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'tools'))
from preload_data import read_pak,verify_preload
spec=importlib.util.spec_from_file_location('native_graphics',ROOT/'tools/build-hd-assets.py');graphics=importlib.util.module_from_spec(spec);spec.loader.exec_module(graphics)
SHA=lambda data:hashlib.sha256(data).hexdigest()

def inventory():
 members=read_pak('DUNE.PAK');raw=members['ICON.MAP']['bytes'];words=struct.unpack('<'+'H'*(len(raw)//2),raw);icons=graphics.icon_frames(members['ICON.ICN']['bytes']);pal=bytearray((v*65)>>4 for v in members['IBM.PAL']['bytes']);pal[223*3:223*3+3]=bytes(3)
 content=json.loads((ROOT/'dist/assets/content.json').read_text());types=[]
 for s in content['structures']:
  if s['id'] in [0,1,14]:continue
  group=s['iconGroup'];seq=words[words[group]:(words[group+1] or len(words))];count=s['width']*s['height'];states=[list(seq[n:n+count])for n in range(0,len(seq),count)]
  types.append(dict(id=s['id'],name=s['name'],group=group,width=s['width']*16,height=s['height']*16,states=states))
 sources={name:members[name]['sha256']for name in ['ICON.ICN','ICON.MAP','IBM.PAL']};sources['preload']=verify_preload()['packageSha256']
 return types,icons,bytes(pal),sources

def whole(s,state,icons,palette):
 w,h=s['width'],s['height'];pixels=bytearray(w*h*4);cells=s['states'][state]
 for n,tile in enumerate(cells):
  f=icons[tile]
  for y in range(16):
   for x in range(16):
    q=y*16+x;index=f['palette'][f['indices'][q]]
    if 144<=index<=159:index+=16
    at=((n//(w//16)*16+y)*w+n%(w//16)*16+x)*4;pixels[at:at+4]=palette[index*3:index*3+3]+bytes([255*f['mask'][q]])
 return w,h,pixels

def sheet(name,records,cols,rows,types,icons,palette):
 cell=256;gap=32;w=cols*cell+(cols-1)*gap;h=rows*cell+(rows-1)*gap;pixels=bytearray(w*h*4);meta=[]
 byid={s['id']:s for s in types}
 for n,(sid,state)in enumerate(records):
  s=byid[sid];sw,sh,src=whole(s,state,icons,palette);scale=min(192//sw,192//sh);dx=n%cols*(cell+gap)+(cell-sw*scale)//2;dy=n//cols*(cell+gap)+(cell-sh*scale)//2
  for y in range(sh*scale):
   for x in range(sw*scale):
    q=(y//scale*sw+x//scale)*4;at=((dy+y)*w+dx+x)*4;pixels[at:at+4]=src[q:q+4]
  native=REF/f"structure-{sid:02d}-state-{state:02d}.png";graphics.write_png(native,sw,sh,src)
  meta.append(dict(cell=n,structureId=sid,state=state,name=s['name'],width=sw,height=sh,tileIds=s['states'][state],referenceInk=[dx,dy,sw*scale,sh*scale]))
 target=REF/f'{name}.png';graphics.write_png(target,w,h,pixels)
 return dict(name=name,reference=target.name,columns=cols,rows=rows,cellSize=cell,gutter=gap,width=w,height=h,frames=meta,sha256=SHA(target.read_bytes()))

def main():
 types,icons,palette,sources=inventory();groups=[]
 groups.append(sheet('base-a',[(i,2)for i in [2,3,4,5]],2,2,types,icons,palette))
 groups.append(sheet('base-b',[(i,2)for i in [6,7,10,11]],2,2,types,icons,palette))
 groups.append(sheet('base-c',[(i,2)for i in [12,13,17,18]],2,2,types,icons,palette))
 groups.append(sheet('turrets',[(i,s)for i in [15,16]for s in range(2,10)],4,4,types,icons,palette))
 foundation=[(2,0),(2,1),(4,0),(5,0),(3,0),(3,1),(8,0),(18,1),(11,1),(15,0),(15,1)]
 groups.append(sheet('foundation-rubble',foundation,4,3,types,icons,palette))
 alternates=[(3,4),(4,4),(4,6),(5,3),(7,3),(11,4),(11,6),(11,8),(12,4),(12,6),(12,8),(13,8),(18,3),(18,4),(18,5),(2,3)]
 groups.append(sheet('alternate-major-a',alternates[:8],4,2,types,icons,palette))
 groups.append(sheet('alternate-major-b',alternates[8:],4,2,types,icons,palette))
 # Walls: every16px tile is a complete connection state, not a terrain fragment.
 walls=[];walltypes=[]
 for n,tile in enumerate(range(33,108)):
  sid=1000+tile;walltypes.append(dict(id=sid,name='Wall '+str(tile),width=16,height=16,states=[[tile]]));walls.append((sid,0))
 for n in range(5):groups.append(sheet('walls-'+str(n),walls[n*15:n*15+15],5,3,walltypes,icons,palette))
 result=dict(schema=1,baseHouse=1,sources=sources,types=types,groups=groups,ownedNativeIds=list(range(33,108))+list(range(210,389)),paletteCycle223='Native dark endpoint for references; runtime current palette supplies blue emission',coverage=dict(structureTypes=19,buildingTypes=16,wholeStateRecords=sum(len(s['states'])for s in types),nativeIds=254))
 (ART/'native-inventory.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'groups':len(groups),'wholeNativeStates':result['coverage']['wholeStateRecords'],'ownedIds':254}))
if __name__=='__main__':main()
