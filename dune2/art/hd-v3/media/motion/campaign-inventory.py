#!/usr/bin/env python3
"""Static campaign-map composition, index witnesses and semantic click data."""
from pathlib import Path
import ast,base64,configparser,hashlib,json,struct,sys
ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'tools'))
from preload_data import verify_preload,read_pak
HERE=Path(__file__).resolve().parent
namespace={'__file__':str(HERE/'build-motion.py')}
code=(HERE/'build-motion.py').read_text();exec(code[:code.index('content=json.loads')],namespace)
sha=lambda raw:hashlib.sha256(raw).hexdigest()
preload=verify_preload();members={}
for file in preload['files']:
 if file['name'].endswith('.PAK'):
  for name,row in read_pak(file['name']).items():members.setdefault(name,{**row,'archive':file['name']})
out=HERE/'campaign';out.mkdir(exist_ok=True)
images={};rows=[]
for name in ['DUNEMAP.CPS','DUNERGN.CPS','MAPMACH.CPS','RGNCLK.CPS']:
 r=members[name];raw=r['bytes'];compression,expanded,palettes=struct.unpack_from('<HIH',raw,2);data=raw[10+palettes:]
 pixels=namespace['format80'](data,64000)[0]if compression==4 else data[:expanded]
 assert expanded==64000 and len(pixels)==64000
 palette6=raw[10:10+palettes]if palettes else members['IBM.PAL']['bytes'];palette=bytes((v*65)>>4 for v in palette6)
 stem=name.lower().replace('.cps','');(out/f'{stem}.idx').write_bytes(pixels);namespace['png'](out/f'{stem}-native.png',pixels,320,200,palette);images[name]=pixels
 rows.append(dict(resource=name,archive=r['archive'],sourceSha256=r['sha256'],indicesSha256=sha(pixels),nativeDimensions=[320,200],indexFile=f'{stem}.idx',nativePng=f'{stem}-native.png',compression=compression))
# Region artwork is a separate visible SHP layer. Exclude every possible region
# alpha footprint when choosing stable visible-map witnesses.
original=json.loads((ROOT/'dist/painted/native.json').read_text());overlay=bytearray(64000)
config=configparser.ConfigParser();config.read_string(members['REGIONA.INI']['bytes'].decode('latin1').rstrip('\0'))
for key,value in config.items('PIECES'):
 try:region=int(key);x,y=[int(v.strip())for v in value.split(',')]
 except ValueError:continue
 frame=original['frames']['ui'].get(str(477+region))
 if not frame:continue
 mask=base64.b64decode(frame['maskBase64']);w=frame['sourceW'];h=frame['sourceH'];x+=8;y+=24
 for yy in range(h):
  for xx in range(w):
   if mask[yy*w+xx]and 0<=x+xx<320 and 0<=y+yy<200:overlay[(y+yy)*320+x+xx]=1
witnesses={}
for name in ['DUNEMAP.CPS','DUNERGN.CPS','MAPMACH.CPS']:
 raw=images[name];points=[]
 if name=='MAPMACH.CPS':candidates=[(x,y)for y in range(25,143,6)for x in [0,2,4,6,313,315,317,319]]+[(x,y)for y in [194,196,198]for x in range(60,262,7)]
 else:candidates=[(x,y)for y in range(24,144)for x in range(8,312)if name!='DUNERGN.CPS'or not overlay[y*320+x]]
 candidates=sorted(candidates,key=lambda xy:((images['DUNEMAP.CPS'][xy[1]*320+xy[0]]==images['DUNERGN.CPS'][xy[1]*320+xy[0]])if name!='MAPMACH.CPS'else False,(xy[0]*73856093^xy[1]*19349663)&0xffffffff))
 # Broad spatial separation and non-house-remapped indices make these useful
 # scene witnesses; UI/arrows can still occlude them, so exact partial rejection
 # is required at runtime rather than an invented nearest-scene guess.
 for x,y in candidates:
  value=raw[y*320+x]
  if 144<=value<=150 or 251<=value<=254:continue
  if any(abs(px-x)<7 and abs(py-y)<7 for px,py,_ in points):continue
  points.append([x,y,value])
  if len(points)==48:break
 witnesses[name]=points
click=images['RGNCLK.CPS'];packed=b''.join(click[(24+y)*320+8:(24+y)*320+312]for y in range(120));(out/'region-click-304x120.idx').write_bytes(packed)
result=dict(schema=1,sourcePreloadSha256=preload['packageSha256'],resources=rows,visibleMapRect=[8,24,304,120],witnesses=witnesses,regionOverlayAlphaUnionPixels=sum(overlay),clickMask=dict(resource='RGNCLK.CPS',packedDimensions=[304,120],sourceRect=[8,24,304,120],sha256=sha(packed),file='region-click-304x120.idx',values=sorted(set(packed)),formula='g_fileRgnclkCPS[(mouseY-24)*304+mouseX-8]',visible=False),composition={'MAPMACH.CPS':dict(role='visible chrome and reusable house/language atlas',fullSourceIsNotFinalScreen=True,houseCrestDestinations=[[0,152,56,40],[264,152,56,40]],houseCrestSources={'Harkonnen':[0,152,56,40],'Atreides/default':[264,152,56,40],'Ordos':[8,24,56,40]},languageHeaderDest=[8,0,304,24],languageHeaderSources={'German':[8,120,304,24],'French':[8,96,304,24]},mapWellInitiallyCleared=True,statusTextWell=[64,165,192,14]),'DUNEMAP.CPS':dict(role='visible undivided map transition',visibleRect=[8,24,304,120],when='first victory, campaignID1; between PLANET.CPS and DUNERGN.CPS'),'DUNERGN.CPS':dict(role='visible divided map background',visibleRect=[8,24,304,120],overlays='PIECES.SHP native sprite477+region at REGION?.INI [PIECES] position +[8,24], house remap; selection arrows505+arrow, palette251..254 cycles each7 GUI ticks')},evidence=['native/opendune/src/gui/gui.c:GUI_StrategicMap_Show','native/opendune/src/gui/gui.c:GUI_StrategicMap_DrawRegion','native/opendune/src/gui/gui.c:GUI_StrategicMap_ClickedRegion','native/opendune/src/sprites.c:Sprites_CPS_LoadRegionClick'],limits=['These are static native source witnesses, not new art.','RGNCLK is semantic click IDs and must remain unchanged. DUNERGN is visible artwork, not the click mask.','Visible region ownership and selection arrows are dynamic layers; a new background alone does not replace them.','Witnesses exclude possible region alpha footprints and house/palette-cycle indices, but actual UI/cursor occlusion still needs explicit rejection.'],executedOriginalDosBinary=False)
(out/'composition.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'resources':len(rows),'regions':len(set(packed)),'stableWitnesses':{k:len(v)for k,v in witnesses.items()}}))
