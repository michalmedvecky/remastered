"""Statically decode six ordinary Mentat resources, retaining all103 phases.

The existing motion audit is immutable. Reuse only its bounded codec function
definitions; importing its full script would rerun and overwrite that audit.
No DOS or game code is executed. All PAK hashes are verified before decoding.
"""
from pathlib import Path
import ast, base64, collections, hashlib, importlib.util, json, math, struct, zlib

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/hd-v3/media'
OUT=ART/'extra-motion'
sha=lambda b:hashlib.sha256(b).hexdigest()
codec_path=ART/'motion/build-motion.py'
tree=ast.parse(codec_path.read_text())
functions=[node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name in {'png','format80','format40','wsa','bounds','components','contact'}]
assert len(functions)==7
exec(compile(ast.Module(body=functions,type_ignores=[]),str(codec_path),'exec'),globals())
spec=importlib.util.spec_from_file_location('extra_pak_reader',ROOT/'tools/prepare-painted-interface.py')
pak=importlib.util.module_from_spec(spec);spec.loader.exec_module(pak)
spec=importlib.util.spec_from_file_location('extra_rgba_png',ROOT/'tools/build-hd-assets.py')
rgba_png=importlib.util.module_from_spec(spec);spec.loader.exec_module(rgba_png)
expected={row['name'].upper():row['sha256']for row in json.loads((ROOT/'fidelity/original-integrity.json').read_text())['members']}
members={};archive_hashes={}
for file in sorted((ROOT/'native/data').glob('*.PAK')):
 raw=file.read_bytes();assert sha(raw)==expected[file.name.upper()]
 archive_hashes[file.name]=sha(raw)
 for name,data in pak.pak_members(raw):members.setdefault(name,dict(bytes=data,sha256=sha(data),archive=file.name))
resources=[];extra_flat=[]
for name in ('FARTR.WSA','FHARK.WSA','FORDOS.WSA','FREMEN.WSA','WORM.WSA','SARDUKAR.WSA'):
 source=members[name];meta,decoded=wsa(source['bytes']);w,h,count=meta['width'],meta['height'],meta['frame_count'];assert(w,h)==(184,112)and not meta['continuation']
 frames=[f[0]for f in decoded[:count]];stem=name[:-4].lower();folder=OUT/'native'/stem;folder.mkdir(parents=True,exist_ok=True)
 # House-head WSA pictures are shown on the Mercenary/Bene-Gesserit
 # confirmation screen. Retain both palette references for inspection.
 palette_name='BENE.PAL' if name in ('FARTR.WSA','FHARK.WSA','FORDOS.WSA') else 'IBM.PAL'
 pal=bytes((v*65)>>4 for v in members[palette_name]['bytes'])
 first=frames[0];union={p for p in range(w*h)if any(frame[p]!=first[p]for frame in frames[1:])};fm=[];seen={};sequence=[]
 for i,frame in enumerate(frames):
  index=folder/f'frame-{i:03}.idx';index.write_bytes(frame);png(folder/f'frame-{i:03}.png',frame,w,h,pal)
  rgba=b''.join(pal[v*3:v*3+3]+b'\xff'for v in frame)
  rgba_png.write_png(folder/f'frame-{i:03}-rgba.png',w,h,rgba)
  changes=[p for p in range(w*h)if frame[p]!=first[p]];previous=frames[(i-1)%count];step=[p for p in range(w*h)if frame[p]!=previous[p]];digest=sha(frame)
  if digest not in seen:seen[digest]=len(seen)
  sequence.append(seen[digest]);record=dict(frame=i,pixelSha256=digest,indexFile=str(index.relative_to(OUT)),png=f'native/{stem}/frame-{i:03}.png',changedFromFirst=len(changes),changedBounds=bounds(changes,w),changedFromPrevious=len(step),previousDeltaBounds=bounds(step,w),components=components(changes,w,h)[:24])
  if name=='FREMEN.WSA':record['indicatorControls']=dict(left='red'if frame[34*184+26]==144 else'green',right='red'if frame[33*184+29]==144 else'green')
  elif name=='SARDUKAR.WSA':
   ibm=members['IBM.PAL']['bytes'];record['indicatorControls']=dict(blue=round(ibm[frame[17*184+32]*3+2]/63,8),red=round(ibm[frame[20*184+35]*3]/63,8),green=round(ibm[frame[23*184+38]*3+1]/63,8))
  fm.append(record);extra_flat.append((name,i,frame))
 contact(OUT/'review'/f'{stem}-frames-2x.png',frames,w,h,pal,2,5)
 if union:
  x,y,bw,bh=bounds(union,w);x=max(0,x-3);y=max(0,y-3);bw=min(w-x,bw+6);bh=min(h-y,bh+6)
  crops=[b''.join(frame[(y+yy)*w+x:(y+yy)*w+x+bw]for yy in range(bh))for frame in frames]
  contact(OUT/'review'/f'{stem}-motion-detail-4x.png',crops,bw,bh,pal,4,5)
 resources.append(dict(resource=name,archive=source['archive'],resourceSha256=source['sha256'],paletteResource=palette_name,paletteSha256=members[palette_name]['sha256'],nativeWidth=w,nativeHeight=h,frameCount=count,loopRecordFrame=count,loopMatchesFirst=meta['loop_matches_first'],changedPixelUnion=len(union),changedBounds=bounds(union,w),motionComponents=components(union,w,h)[:40],frames=fm,visualPhaseSequence=sequence,distinctVisualPhases=len(seen),classification='pending-visual-review'if count>1 else'static',semanticParts=[],owners=[dict(kind='house-confirmation'if name.startswith('F')and name not in('FREMEN.WSA',)else'mentat-information',name=name[:-4])]))
semantics=json.loads((OUT/'semantics.json').read_text())['resources']
for row in resources:
 guide=semantics[row['resource']];row['classification']=guide['category'];row['visualObservation']=guide['observation'];row['semanticParts']=guide['parts']
 for part in row['semanticParts']:
  x,y,w,h=part['bounds'];seen_part={};part_sequence=[]
  for frame in row['frames']:
   raw=(OUT/frame['indexFile']).read_bytes();crop=b''.join(raw[(y+yy)*184+x:(y+yy)*184+x+w]for yy in range(h));digest=sha(crop)
   if digest not in seen_part:seen_part[digest]=len(seen_part)
   part_sequence.append(seen_part[digest])
  part['nativeVisualPhaseSequence']=part_sequence;part['nativeDistinctPoses']=len(seen_part)
inventory=dict(schema=1,resourceCount=6,frameCount=len(extra_flat),archivesVerified=archive_hashes,resources=resources,limits=['Bounded static Format80/40 decode; no game execution.','Palette selection follows GUI_Mentat_Display Mercenary/BENE confirmation context for house homeworlds; indexed witnesses themselves are palette independent.','FREMEN loop record is retained separately even if it differs from frame0.'])
inventory['nativeLoopEvidence']={'FREMEN.WSA':'Stored loop record clears the canvas, but WSA_DisplayFrame uses the reverse frame1 XOR delta on the equal-distance two-frame wrap (strict frameCount<frameDiff comparison). Actual0/1 playback restores frame0 without consuming the anomalous loop record.','source':'native/opendune/src/wsa.c:WSA_DisplayFrame; native/opendune/src/gui/mentat.c:GUI_Mentat_Loop','phaseTickDelay':7}
assert len(extra_flat)==103
(OUT/'inventory.json').write_text(json.dumps(inventory,indent=2)+'\n')
contact(OUT/'review/all-first-frames-native.png',[row[2]for row in extra_flat if row[1]==0],184,112,bytes((v*65)>>4 for v in members['IBM.PAL']['bytes']),1,3)
# Preserve all existing30 coordinates and add only coordinates needed to
# distinguish the combined264 exact native frame records.
old=json.loads((ART/'motion/frame-witnesses.json').read_text());base_inventory=json.loads((ART/'motion/inventory.json').read_text());flat=[]
for row in base_inventory['resources']:
 for frame in row['frames']:flat.append((row['resource'],frame['frame'],(ART/'motion'/frame['indexFile']).read_bytes()))
flat+=extra_flat;assert len(flat)==264
unique={};equivalent={}
for name,i,frame in flat:digest=sha(frame);unique.setdefault(digest,frame);equivalent.setdefault(digest,[]).append(dict(resource=name,frame=i))
values=list(unique.values());coordinates=[y*184+x for x,y in old['coordinates']]
def regroup():
 groups={}
 for i,frame in enumerate(values):groups.setdefault(bytes(frame[p]for p in coordinates),[]).append(i)
 return list(groups.values())
groups=regroup()
while any(len(g)>1 for g in groups):
 best=-1;best_score=-1
 for p in range(184*112):
  score=0
  for group in groups:
   if len(group)<2:continue
   bins=collections.Counter(values[i][p]for i in group);score+=len(group)**2-sum(n*n for n in bins.values())
  if score>best_score:best_score=score;best=p
 assert best_score>0
 coordinates.append(best);groups=regroup()
rows=[dict(resource=name,frame=i,pixelSha256=sha(frame),signatureBase64=base64.b64encode(bytes(frame[p]for p in coordinates)).decode(),equivalentFrames=equivalent[sha(frame)])for name,i,frame in flat]
result=dict(schema=1,sourcePreloadSha256=old['sourcePreloadSha256'],nativeRect=[128,48,184,112],indexDomain=old['indexDomain'],coordinates=[[p%184,p//184]for p in coordinates],distinctFrameCount=len(unique),totalFrames=len(flat),frames=rows,matching=old['matching'],sourceInventories=['motion/inventory.json','extra-motion/inventory.json'])
(OUT/'global-frame-witnesses.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(dict(extraResources=6,extraFrames=103,totalResources=42,totalFrames=264,distinct=len(unique),witnessCoordinates=len(coordinates))))
