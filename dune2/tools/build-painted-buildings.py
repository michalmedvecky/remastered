"""Pack retained whole-building redraws into native ICON-addressed 4x pieces."""
from pathlib import Path
import argparse,base64,hashlib,importlib.util,json,math,sys
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/hd-v2/buildings';RAW=ART/'raw';OUT=ROOT/'dist/painted';OUT.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('building_references',ROOT/'tools/prepare-painted-buildings.py');reference=importlib.util.module_from_spec(spec);spec.loader.exec_module(reference)
png=reference.graphics;SHA=lambda data:hashlib.sha256(data).hexdigest()

def extract(image,cell,columns,rows,threshold=24,disjoint=False):
 w,h,pixels=image;left=cell%columns*w//columns;right=(cell%columns+1)*w//columns;top=cell//columns*h//rows;bottom=(cell//columns+1)*h//rows
 cw,ch=right-left,bottom-top;seen=bytearray(cw*ch);largest=[];groups=[]
 for y in range(ch):
  for x in range(cw):
   n=y*cw+x
   if seen[n] or pixels[((top+y)*w+left+x)*4+3]<threshold:continue
   queue=[n];seen[n]=1
   for q in queue:
    xx,yy=q%cw,q//cw
    for oy in [-1,0,1]:
     for ox in [-1,0,1]:
      nx,ny=xx+ox,yy+oy;v=ny*cw+nx
      if nx<0 or nx>=cw or ny<0 or ny>=ch or seen[v] or pixels[((top+ny)*w+left+nx)*4+3]<threshold:continue
      seen[v]=1;queue.append(v)
   groups.append(queue)
   if len(queue)>len(largest):largest=queue
 if not largest:raise ValueError('Missing generated object in cell '+str(cell))
 if disjoint:largest=[q for group in groups if len(group)>=max(3,len(largest)//75) for q in group]
 keep=bytearray(cw*ch)
 for n in largest:
  x,y=n%cw,n//cw
  for oy in [-1,0,1]:
   for ox in [-1,0,1]:
    nx,ny=x+ox,y+oy
    if 0<=nx<cw and 0<=ny<ch:keep[ny*cw+nx]=1
 xs=[n%cw for n in largest];ys=[n//cw for n in largest];x0=max(0,min(xs)-1);y0=max(0,min(ys)-1);x1=min(cw,max(xs)+2);y1=min(ch,max(ys)+2)
 out=bytearray((x1-x0)*(y1-y0)*4)
 for y in range(y0,y1):
  for x in range(x0,x1):
   if keep[y*cw+x]:
    a=((top+y)*w+left+x)*4;b=((y-y0)*(x1-x0)+x-x0)*4;out[b:b+4]=pixels[a:a+4]
 return x1-x0,y1-y0,out,[left+x0,top+y0,x1-x0,y1-y0]

def resize(source,width,height):
 sw,sh,pixels,*_=source;out=bytearray(width*height*4)
 for y in range(height):
  fy=(y+.5)*sh/height-.5;y0=max(0,min(sh-1,math.floor(fy)));y1=min(sh-1,y0+1);dy=max(0,fy-y0)
  for x in range(width):
   fx=(x+.5)*sw/width-.5;x0=max(0,min(sw-1,math.floor(fx)));x1=min(sw-1,x0+1);dx=max(0,fx-x0);alpha=0;rgb=[0.,0.,0.]
   for xx,wx in [(x0,1-dx),(x1,dx)]:
    for yy,wy in [(y0,1-dy),(y1,dy)]:
     p=(yy*sw+xx)*4;a=pixels[p+3]/255*wx*wy;alpha+=a
     for k in range(3):rgb[k]+=pixels[p+k]*a
   p=(y*width+x)*4
   if alpha:
    for k in range(3):out[p+k]=max(0,min(255,round(rgb[k]/alpha)))
    out[p+3]=max(0,min(255,round(alpha*255)))
 return out

def slice_tile(pixels,width,x,y):
 return b''.join(pixels[((y+yy)*width+x)*4:((y+yy)*width+x+64)*4]for yy in range(64))

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--allow-partial',action='store_true');args=ap.parse_args()
 inventory=json.loads((ART/'native-inventory.json').read_text());types={s['id']:s for s in inventory['types']};tiles={};objects={};packing=[];raws={};_,icons,palette,_=reference.inventory()
 def add_object(sid,state,image,cell,columns,rows,job,status='painted-whole-object'):
  s=types[sid];cropped=extract(image,cell,columns,rows,disjoint=state==1);width,height=s['width']*4,s['height']*4;pixels=resize(cropped,width,height)
  native_delta=None
  if state>2 and (sid,2)in objects and job.startswith('alternate'):
   base_pixels=objects[(sid,2)][2];original=s['states'][2];current=s['states'][state];cols=s['width']//16;changed_cells={i for i,(a,b)in enumerate(zip(original,current))if a!=b};points=[]
   for n in changed_cells:
    old,new=icons[original[n]],icons[current[n]]
    for q in range(256):
     before=(old['palette'][old['indices'][q]],old['mask'][q]);after=(new['palette'][new['indices'][q]],new['mask'][q])
     if before!=after:points.append((n%cols*16+q%16,n//cols*16+q//16))
   if points:
    left=min(x for x,y in points)*4;top=min(y for x,y in points)*4;right=(max(x for x,y in points)+1)*4;bottom=(max(y for x,y in points)+1)*4;native_delta=[left//4,top//4,right//4,bottom//4];composite=bytearray(base_pixels)
    for n in changed_cells:
     x0=n%cols*64;y0=n//cols*64
     for yy in range(64):
      for xx in range(64):
       x=x0+xx;y=y0+yy;weight=min(1,max(0,(x-left+8)/5),max(0,(right+8-x)/5),max(0,(y-top+8)/5),max(0,(bottom+8-y)/5))
       if n%cols and n-1 not in changed_cells:weight=min(weight,xx/5)
       if n%cols<cols-1 and n+1 not in changed_cells:weight=min(weight,(63-xx)/5)
       if n>=cols and n-cols not in changed_cells:weight=min(weight,yy/5)
       if n+cols<len(current) and n+cols not in changed_cells:weight=min(weight,(63-yy)/5)
       if not weight:continue
       q=(y*width+x)*4
       for k in range(4):composite[q+k]=round(base_pixels[q+k]*(1-weight)+pixels[q+k]*weight)
    pixels=composite;status='painted-whole-alternate-native-region-composite'
  objects[(sid,state)]=(width,height,pixels)
  record=dict(structureId=sid,state=state,job=job,cell=cell,crop=cropped[3],width=width,height=height,status=status,nativeDeltaBounds=native_delta);packing.append(record)
  for n,tile in enumerate(s['states'][state]):
   if tile not in inventory['ownedNativeIds'] or tile in tiles:continue
   x=n%(s['width']//16)*64;y=n//(s['width']//16)*64
   tiles[tile]=dict(pixels=slice_tile(pixels,width,x,y),structureId=sid,variant=state,sourceTileId=tile,status=status,job=job,wholeCell=n)
 approved=RAW/'pilot-approved.png'
 if approved.is_file():
  image=png.read_png(approved);raws[approved.name]=SHA(approved.read_bytes());add_object(8,2,image,0,2,1,'pilot-approved');add_object(9,2,image,1,2,1,'pilot-approved')
 for group in inventory['groups']:
  name=group['name'];path=RAW/(name+'.png')
  if not path.is_file():continue
  image=png.read_png(path);raws[path.name]=SHA(path.read_bytes())
  for frame in group['frames']:
   if frame['structureId']>=1000:
    tile=frame['tileIds'][0];native=icons[tile];points=[i for i,a in enumerate(native['mask'])if a];left=min(i%16 for i in points);top=min(i//16 for i in points);right=max(i%16 for i in points)+1;bottom=max(i//16 for i in points)+1
    cropped=extract(image,frame['cell'],group['columns'],group['rows'],threshold=160,disjoint=tile==33);small=resize(cropped,(right-left)*4,(bottom-top)*4);pixels=bytearray(64*64*4)
    for y in range((bottom-top)*4):pixels[((top*4+y)*64+left*4)*4:((top*4+y)*64+right*4)*4]=small[y*(right-left)*16:(y+1)*(right-left)*16]
    tiles[tile]=dict(pixels=bytes(pixels),structureId=14,variant=tile-33,sourceTileId=tile,status='painted-wall-native-connection',job=name,wholeCell=frame['cell'],sourceInkBounds=[left,top,right-left,bottom-top]);packing.append(dict(structureId=14,state=tile-33,tileId=tile,job=name,cell=frame['cell'],crop=cropped[3],sourceInkBounds=[left,top,right-left,bottom-top],status='painted-wall-native-connection'))
    continue
   add_object(frame['structureId'],frame['state'],image,frame['cell'],group['columns'],group['rows'],name)
 # Native per-building flag frames differ by9–23 source pixels. Keep the whole
 # painted building geometry, and vary only smooth painted blue marker lighting.
 # This is an explicitly derived display state, not another model generation.
 def native_tokens(tile):
  f=icons[tile];return[(f['palette'][c],f['mask'][i])for i,c in enumerate(f['indices'])]
 for target in sorted(set(range(210,389))-set(tiles)):
  candidates=[]
  for s in types.values():
   for state in s['states']:
    for position,tile in enumerate(state):
     if tile!=target:continue
     for phase,other in enumerate(s['states']):
      source=other[position]
      if source not in tiles:continue
      delta=[i for i,(a,b)in enumerate(zip(native_tokens(source),native_tokens(target)))if a!=b]
      candidates.append((len(delta),s['id'],phase,position,source,delta))
  if not candidates:continue
  count,sid,phase,position,source,delta=min(candidates)
  if count>24:continue
  original=tiles[source];pixels=bytearray(original['pixels']);changed=0
  # Moving highlight over the genuinely painted blue flag/house marker. This
  # preserves new RGBA contours instead of reconstructing original microblocks.
  seed=sum((i+1)*native_tokens(target)[i][0]for i in delta);cx=(min(i%16 for i in delta)+max(i%16 for i in delta)+1)*2;cy=(min(i//16 for i in delta)+max(i//16 for i in delta)+1)*2
  for y in range(64):
   for x in range(64):
    q=(y*64+x)*4;r,g,b,a=pixels[q:q+4]
    if a>64 and b>r*1.18 and b>g*1.04 and b-r>14:
     weight=math.exp(-((x-cx)**2+(y-cy)**2)/(2*16**2))
     if weight<.04:continue
     gain=1+.12*math.sin((x+y*.35+seed%23)*.24)*weight
     for k in range(3):pixels[q+k]=max(0,min(255,round(pixels[q+k]*gain)))
     changed+=1
  if not changed:raise ValueError('Missing painted blue marker for native flag '+str(target))
  tiles[target]={**original,'pixels':bytes(pixels),'variant':'flag-phase-'+str(target),'sourceTileId':target,'status':'painted-derived-native-flag-state','derivedFrom':source,'nativeChangedPixels':count,'nativeDeltaBounds':[min(i%16 for i in delta),min(i//16 for i in delta),max(i%16 for i in delta)+1,max(i//16 for i in delta)+1],'paintedMarkerPixels':changed,'derivation':'Native flag pose selects smooth painted blue-marker highlight phase; unchanged whole-object geometry'}
  packing.append(dict(structureId=sid,tileId=target,sourceTileId=source,status='painted-derived-native-flag-state',nativeChangedPixels=count,paintedMarkerPixels=changed))
 missing=sorted(set(inventory['ownedNativeIds'])-set(tiles));complete=not missing
 if missing and not args.allow_partial:raise ValueError('Building native ICON coverage missing '+str(missing))
 owned=inventory['ownedNativeIds'];atlas=bytearray(1024*1024*4);records={}
 for n,tile in enumerate(owned):
  if tile not in tiles:continue
  item=tiles[tile];x=n%16*64;y=n//16*64
  for yy in range(64):atlas[((y+yy)*1024+x)*4:((y+yy)*1024+x+64)*4]=item['pixels'][yy*64*4:(yy+1)*64*4]
  records[str(tile)]={k:v for k,v in item.items()if k!='pixels'};records[str(tile)].update(atlas='buildings',x=x,y=y,w=64,h=64)
  if tile in [304,305,306,307,308]:
   mask=bytearray(4096)
   for q in range(4096):
    r,g,b,a=item['pixels'][q*4:q*4+4];dark=max(0,min(1,(64-max(r,g,b))/36));mask[q]=round(dark*a)
   records[str(tile)]['paletteCycle223']=True;records[str(tile)]['emissionMaskBase64']=base64.b64encode(mask).decode('ascii');records[str(tile)]['emissionMaskSource']='Smooth darkness of new painted air apertures; no original pixel-index mask'
 temp=OUT/'buildings-pending.png';digest=png.write_png(temp,1024,1024,atlas);name='buildings-'+digest[:16]+'.png';target=OUT/name;temp.replace(target)
 for old in OUT.glob('buildings-*.png'):
  if old!=target:old.unlink()
 content=json.loads((ROOT/'dist/assets/content.json').read_text());state_mappings={}
 for original in content['structures']:
  sid=original['id'];s=types.get(sid);states=[]
  if s:
   for phase,ids in enumerate(s['states']):states.append(dict(index=phase,tileIds=ids,statuses=sorted({records[str(i)]['status']if str(i)in records else 'terrain-owned-shared-tile'for i in ids}),complete=all(str(i)in records or i in[125,143]for i in ids)))
  elif sid==14:states=[dict(index=i,tileIds=[33+i],statuses=['painted-wall-native-connection'],complete=str(33+i)in records)for i in range(75)]
  else:states=[dict(index=i,tileIds=[124+i],statuses=['terrain-owned-concrete'],complete=True)for i in range(3)]
  state_mappings[str(sid)]=dict(name=original['name'],iconGroup=original['iconGroup'],width=original['width']*16,height=original['height']*16,ownership='terrain'if sid in[0,1]else'buildings',states=states)
 statuses={status:sum(r['status']==status for r in records.values())for status in sorted({r['status']for r in records.values()})}
 result=dict(schema=1,version='painted-v2',scale=4,baseHouse=1,source=inventory['sources'],atlases={'buildings':dict(src='painted/'+name,width=1024,height=1024,sha256=digest,bytes=target.stat().st_size)},tiles=records,structures=state_mappings,coverage=dict(complete=complete,expectedNativeIds=254,coveredNativeIds=len(records),missingNativeIds=missing,structureTypesTotal=19,semanticBuildingTypes=16,nativeWholeStateRecords=inventory['coverage']['wholeStateRecords'],statuses=statuses),semantics=dict(art='Whole semantic building redraws sliced only after fitting to unchanged native footprint',houseColour='Base Atreides blue; runtime recolours painted blue hue rather than restoring original index colours',paletteCycle223='Windtrap intake emission follows active original palette',otherStructureTypes='Concrete slabs owned by terrain and walls counted in this bank',minorFlagStates='Native flag state advances a smooth painted marker highlight; exact original cloth-pixel silhouettes are not recreated'))
 (OUT/'buildings.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
 (ART/'packing.json').write_text(json.dumps(dict(rawHashes=raws,objects=packing,atlasSha256=digest,tileSourceHashes={str(k):SHA(v['pixels'])for k,v in tiles.items()},coverage=result['coverage']),indent=2)+'\n')
 # Review the actual canonical ICON pieces reassembled into every whole state,
 # rather than showing raw model cells that the runtime does not consume.
 review_w=8*208;states=[(s,phase,ids)for s in types.values()for phase,ids in enumerate(s['states'])];review_h=math.ceil(len(states)/8)*208;review=bytearray(review_w*review_h*4)
 for cell,(s,phase,ids)in enumerate(states):
  cols=s['width']//16;ox=cell%8*208+(208-s['width']*4)//2;oy=cell//8*208+(208-s['height']*4)//2
  for n,tile in enumerate(ids):
   if tile in tiles:pixels=tiles[tile]['pixels']
   else:
    f=icons[tile];pixels=bytearray(64*64*4)
    for y in range(64):
     for x in range(64):
      q=y//4*16+x//4;index=f['palette'][f['indices'][q]];at=(y*64+x)*4;pixels[at:at+4]=palette[index*3:index*3+3]+bytes([f['mask'][q]*255])
   x0=ox+n%cols*64;y0=oy+n//cols*64
   for y in range(64):review[((y0+y)*review_w+x0)*4:((y0+y)*review_w+x0+64)*4]=pixels[y*256:(y+1)*256]
 review_dir=ART/'review';review_dir.mkdir(exist_ok=True);png.write_png(review_dir/'assembled-native-states.png',review_w,review_h,review)
 (review_dir/'assembled-native-states.json').write_text(json.dumps([dict(cell=n,structureId=s['id'],name=s['name'],state=phase,tileIds=ids)for n,(s,phase,ids)in enumerate(states)],indent=2)+'\n')
 print(json.dumps(dict(covered=len(records),expected=254,complete=complete,atlas=name)))
if __name__=='__main__':main()
