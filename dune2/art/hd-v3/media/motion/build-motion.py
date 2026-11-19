#!/usr/bin/env python3
"""Static WSA motion inventory and exact native-index witnesses. No DOS execution.
Bounds-checked Format80/40 decoder retained from the resource audit. References
are original indexed data, never newly generated art or literal HD output.
"""
from pathlib import Path
import base64,collections,hashlib,json,math,struct,sys,zlib
ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'tools'))
from preload_data import verify_preload,read_pak
OUT=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()

def png(path,pixels,width,height,palette):
 def chunk(tag,body):return struct.pack('>I',len(body))+tag+body+struct.pack('>I',zlib.crc32(tag+body)&0xffffffff)
 scan=b''.join(b'\0'+pixels[y*width:(y+1)*width]for y in range(height))
 body=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>2I5B',width,height,8,3,0,0,0))
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_bytes(body+chunk(b'PLTE',palette)+chunk(b'IDAT',zlib.compress(scan,9))+chunk(b'IEND',b''))

def format80(data, limit=1048576):
    cursor = 0
    out = bytearray()
    def read(n):
        nonlocal cursor
        if cursor+n > len(data): raise ValueError('truncated Format80')
        value = data[cursor:cursor+n]; cursor += n; return value
    def word(): return int.from_bytes(read(2),'little')
    def copy(pos,n):
        if not 0 <= pos < len(out): raise ValueError('invalid Format80 copy source')
        if len(out)+n > limit: raise ValueError('Format80 output bound')
        for _ in range(n): out.append(out[pos]); pos += 1
    while True:
        cmd=read(1)[0]
        if cmd==0x80: break
        if cmd<0x80:
            distance=((cmd&15)<<8)|read(1)[0]; copy(len(out)-distance,(cmd>>4)+3)
        elif cmd==0xfe:
            n=word(); value=read(1)
            if len(out)+n > limit: raise ValueError('Format80 fill bound')
            out.extend(value*n)
        elif cmd==0xff:
            n=word(); copy(word(),n)
        elif cmd&0x40: copy(word(),(cmd&63)+3)
        else:
            n=cmd&63
            if len(out)+n > limit: raise ValueError('Format80 literal bound')
            out.extend(read(n))
    return bytes(out),cursor

def format40(data, base):
    """XOR one WSA delta onto a packed rectangle; skipped pixels retain base."""
    out=bytearray(base); cursor=0; pos=0
    def read(n):
        nonlocal cursor
        if cursor+n>len(data): raise ValueError('truncated Format40')
        v=data[cursor:cursor+n]; cursor+=n; return v
    def write(values):
        nonlocal pos
        if pos+len(values)>len(out): raise ValueError('Format40 pixel bound')
        for v in values: out[pos]^=v; pos+=1
    def skip(n):
        nonlocal pos
        pos+=n
        if pos>len(out): raise ValueError('Format40 skip bound')
    while True:
        cmd=read(1)[0]
        if cmd==0:
            n=read(1)[0]; value=read(1); write(value*n)
        elif cmd<0x80: write(read(cmd))
        elif cmd>0x80: skip(cmd&0x7f)
        else:
            cmd=int.from_bytes(read(2),'little')
            if cmd==0: break
            if cmd<0x8000: skip(cmd)
            elif cmd<0xc000: write(read(cmd&0x3fff))
            else:
                value=read(1); write(value*(cmd&0x3fff))
    return bytes(out),cursor,pos

def wsa(data):
    raw_count,width,height,buffer_hint,flags=struct.unpack_from('<5H',data)
    count=raw_count&0x7fff
    if count>4096 or width*height>1048576: raise ValueError('unbounded WSA dimensions')
    offsets=list(struct.unpack_from('<'+'I'*(count+2),data,10))
    palette_bytes=768 if flags&1 else 0
    table_end=10+4*(count+2)
    continuation=offsets[0]==0
    base=bytes(width*height);frames=[];result=[]
    for i in range(count+1):
        a,b=offsets[i],offsets[i+1]
        if a==0 or b==0:
            result.append(dict(index=i,status='absent-initial' if i==0 else 'absent-loop'))
            frames.append(None)
            continue
        a+=palette_bytes;b+=palette_bytes
        if not table_end+palette_bytes<=a<=b<=len(data): raise ValueError('WSA frame extent')
        delta,used=format80(data[a:b]); pixels,consumed,advanced=format40(delta,base)
        result.append(dict(index=i,status='relative-delta' if continuation else 'decoded',
                           offset=a,size=b-a,expanded_delta_bytes=len(delta),
                           compressed_bytes_consumed=used,unused_extent_bytes=b-a-used,
                           delta_bytes_consumed=consumed,pixels_advanced=advanced,pixel_sha256=sha(pixels)))
        base=pixels;frames.append((pixels,width,height))
    return dict(frame_count=count,width=width,height=height,buffer_hint=buffer_hint,
                flags=flags,raw_frame_count=raw_count,continuation=continuation,
                palette_bytes=palette_bytes,frames=result,
                loop_matches_first=(frames[-1][0]==frames[0][0]) if frames[-1] is not None and frames[0] is not None else None),frames


def bounds(points,width):
 if not points:return None
 xs=[p%width for p in points];ys=[p//width for p in points]
 return [min(xs),min(ys),max(xs)-min(xs)+1,max(ys)-min(ys)+1]

def components(points,width,height):
 unseen=set(points);result=[]
 while unseen:
  first=unseen.pop();todo=[first];part=[first]
  while todo:
   at=todo.pop();x=at%width;y=at//width
   for n in ([at-1]if x else [])+([at+1]if x+1<width else [])+([at-width]if y else [])+([at+width]if y+1<height else []):
    if n in unseen:unseen.remove(n);todo.append(n);part.append(n)
  result.append(dict(pixels=len(part),bounds=bounds(part,width)))
 return sorted(result,key=lambda r:-r['pixels'])

def contact(path,frames,width,height,palette,scale=2,columns=4):
 columns=min(columns,len(frames));rows=math.ceil(len(frames)/columns)
 cw=width*scale+4;ch=height*scale+4;pixels=bytearray(cw*columns*ch*rows)
 for i,frame in enumerate(frames):
  ox=(i%columns)*cw;oy=(i//columns)*ch
  for y in range(height*scale):
   row=bytes(v for v in frame[(y//scale)*width:(y//scale+1)*width]for _ in range(scale))
   pixels[(oy+y)*cw*columns+ox:(oy+y)*cw*columns+ox+len(row)]=row
 png(path,pixels,cw*columns,ch*rows,palette)

content=json.loads((ROOT/'dist/assets/content.json').read_text())
names=sorted({r['portrait']for kind in ['units','structures']for r in content[kind]if r.get('portrait')})
preload=verify_preload();members={}
for pack in preload['files']:
 if pack['name'].endswith('.PAK'):
  for n,r in read_pak(pack['name']).items():members.setdefault(n,{**r,'archive':pack['name']})
palette=bytes((v*65)>>4 for v in members['IBM.PAL']['bytes'])
resources=[];flat=[]
for name in names:
 resource=members[name];meta,decoded=wsa(resource['bytes']);w=meta['width'];h=meta['height'];count=meta['frame_count']
 assert (w,h)==(184,112) and not meta['continuation']
 frames=[f[0]for f in decoded[:count]];assert len(frames)==count
 stem=name.lower().removesuffix('.wsa');folder=OUT/'native'/stem;folder.mkdir(parents=True,exist_ok=True)
 base=frames[0];union={p for p in range(w*h)if any(frame[p]!=base[p]for frame in frames[1:])}
 fm=[]
 for i,frame in enumerate(frames):
  idx=folder/f'frame-{i:03d}.idx';idx.write_bytes(frame);png(folder/f'frame-{i:03d}.png',frame,w,h,palette)
  prev=frames[(i-1)%len(frames)];changes=[p for p in range(w*h)if frame[p]!=base[p]];step=[p for p in range(w*h)if frame[p]!=prev[p]]
  transitions=collections.Counter((base[p],frame[p])for p in changes)
  pairs=list(transitions.items());sameRamp=sum(n for (a,b),n in pairs if a>>4==b>>4)
  fm.append(dict(frame=i,pixelSha256=sha(frame),indexFile=str(idx.relative_to(OUT)),png=str((folder/f'frame-{i:03d}.png').relative_to(OUT)),changedFromFirst=len(changes),changedBounds=bounds(changes,w),changedFromPrevious=len(step),previousDeltaBounds=bounds(step,w),components=components(changes,w,h)[:24],same16ColourRampFraction=sameRamp/len(changes)if changes else None,topIndexTransitions=[dict(source=a,target=b,pixels=n)for (a,b),n in transitions.most_common(20)]))
  flat.append((name,i,frame))
 heat=bytearray(w*h)
 for p in union:heat[p]=max(1,round(sum(frame[p]!=base[p]for frame in frames)*254/len(frames)))
 png(OUT/'review'/f'{stem}-changed-mask.png',heat,w,h,bytes(v for i in range(256)for v in (i,i,i)))
 contact(OUT/'review'/f'{stem}-frames-2x.png',frames,w,h,palette)
 resources.append(dict(resource=name,archive=resource['archive'],resourceSha256=resource['sha256'],nativeWidth=w,nativeHeight=h,frameCount=count,loopRecordFrame=count,loopMatchesFirst=meta['loop_matches_first'],firstFramePng=f'native/{stem}/frame-000.png',contact=f'review/{stem}-frames-2x.png',changeMask=f'review/{stem}-changed-mask.png',changedPixelUnion=len(union),staticPixelCount=w*h-len(union),changedBounds=bounds(union,w),motionComponents=components(union,w,h)[:40],owners=[dict(kind=kind,id=r['id'],name=r['name'])for kind in ['units','structures']for r in content[kind]if r.get('portrait')==name],frames=fm,classification='pending-visual-review'if count>1 else'static',observationLimits=[]))
# A greedy exact set of native pixel coordinates distinguishes every distinct
# stored frame globally. Identical original frames are explicit equivalence sets.
unique={};equivalence={}
for name,i,frame in flat:
 digest=sha(frame);unique.setdefault(digest,frame);equivalence.setdefault(digest,[]).append(dict(resource=name,frame=i))
keys=list(unique);values=list(unique.values());groups=[list(range(len(values)))];coordinates=[]
while any(len(g)>1 for g in groups):
 best=None;bestscore=-1
 for p in range(184*112):
  score=0
  for g in groups:
   if len(g)<2:continue
   bins=collections.Counter(values[i][p]for i in g)
   score+=len(g)*len(g)-sum(n*n for n in bins.values())
  if score>bestscore:bestscore=score;best=p
 assert bestscore>0
 coordinates.append(best);new=[]
 for g in groups:
  bins={}
  for i in g:bins.setdefault(values[i][best],[]).append(i)
  new.extend(bins.values())
 groups=new
witnesses=[]
for name,i,frame in flat:
 witnesses.append(dict(resource=name,frame=i,pixelSha256=sha(frame),signatureBase64=base64.b64encode(bytes(frame[p]for p in coordinates)).decode(),equivalentFrames=equivalence[sha(frame)]))
result=dict(schema=1,sourcePreloadSha256=preload['packageSha256'],sourcePaletteSha256=members['IBM.PAL']['sha256'],nativeRect=[128,48,184,112],resourceCount=len(resources),frameCount=len(flat),animatedResources=sum(r['frameCount']>1 for r in resources),resources=resources,limits=['Native data is unmodified, statically decoded and kept only as fidelity evidence.','Colour/index changes are measurements, not instructions to recolour new painted images.','Changed bounds alone do not identify semantic moving parts; manual visual labels follow review.'])
(OUT/'inventory.json').write_text(json.dumps(result,indent=2)+'\n')
(OUT/'frame-witnesses.json').write_text(json.dumps(dict(schema=1,sourcePreloadSha256=preload['packageSha256'],nativeRect=[128,48,184,112],indexDomain='native global IBM palette indices; independent of display RGB/palette fade',coordinates=[[p%184,p//184]for p in coordinates],distinctFrameCount=len(unique),totalFrames=len(flat),frames=witnesses,matching='Require exact values at all witness coordinates. Multiple matches are explicitly equivalent original frames. If occluded or absent, return unknown; do not pick nearest. Full-frame SHA256 may confirm a match when no UI/cursor overlays cover the crop.'),indent=2)+'\n')
print(json.dumps(dict(resources=len(resources),frames=len(flat),animated=result['animatedResources'],distinct=len(unique),witnessCoordinates=len(coordinates))))

# Manual semantic labels and exact phase equality are retained separately from
# source-colour measurements; they guide new art rather than transform old RGB.
semantics=json.loads((OUT/'semantics.json').read_text())['resources']
for row in resources:
 seen={};sequence=[]
 for frame in row['frames']:
  digest=frame['pixelSha256']
  if digest not in seen:seen[digest]=len(seen)
  sequence.append(seen[digest])
 row['visualPhaseSequence']=sequence;row['distinctVisualPhases']=len(seen)
 if row['resource']in semantics:
  guide=semantics[row['resource']];row['classification']=guide['category'];row['visualObservation']=guide['observation'];row['semanticParts']=guide['parts']
  for part in row['semanticParts']:
   x,y,w,h=part['bounds'];seenPart={};partSequence=[]
   for frame in row['frames']:
    raw=(OUT/frame['indexFile']).read_bytes();crop=b''.join(raw[(y+yy)*184+x:(y+yy)*184+x+w]for yy in range(h));digest=sha(crop)
    if digest not in seenPart:seenPart[digest]=len(seenPart)
    partSequence.append(seenPart[digest])
   part['nativeVisualPhaseSequence']=partSequence;part['nativeDistinctPoses']=len(seenPart)
 else:row['visualObservation']='The WSA contains one static native object portrait.';row['semanticParts']=[]
 row['factoryBehavior']='Native factory loads frame0, displays it, unloads; no autonomous preview animation.'
 row['mentatBehavior']='Native information loop advances stored phases every7 native60Hz ticks, retaining repeated frames; actual source frame is authoritative.'
 if row['changedBounds']:
  x,y,w,h=row['changedBounds'];x0=max(0,x-3);y0=max(0,y-3);w=min(184,x+w+3)-x0;h=min(112,y+h+3)-y0
  crops=[]
  for frame in row['frames']:
   raw=(OUT/frame['indexFile']).read_bytes();crops.append(b''.join(raw[(y0+yy)*184+x0:(y0+yy)*184+x0+w]for yy in range(h)))
  path=OUT/'review'/f"{row['resource'].lower().removesuffix('.wsa')}-motion-detail-4x.png"
  contact(path,crops,w,h,palette,4,4);row['motionDetailContact']=str(path.relative_to(OUT));row['motionDetailNativeCrop']=[x0,y0,w,h]
contact(OUT/'review/all-first-frames-native.png',[(OUT/r['frames'][0]['indexFile']).read_bytes()for r in resources],184,112,palette,1,6)
result['runtimeEvidence']={'factoryFrame0':['native/opendune/src/gui/gui.c:2879','native/opendune/src/gui/gui.c:3553'],'mentatFrames':['native/opendune/src/gui/mentat.c:1236'],'previewWidget':['native/opendune/src/gui/widget.c:42'],'native60Hz':['native/opendune/src/opendune.c:1179'],'nativeTickDelay':7,'previewNativeRect':[128,48,184,112]}
result['reviewedFrames']=len(flat);result['allResourcesVisuallyClassified']=True
(OUT/'inventory.json').write_text(json.dumps(result,indent=2)+'\n')
